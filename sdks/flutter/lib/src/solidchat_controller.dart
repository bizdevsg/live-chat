import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

import 'api_client.dart';
import 'models.dart';
import 'realtime.dart';
import 'storage.dart';

class SolidChatController extends ChangeNotifier {
  SolidChatController({
    this.config = const SolidChatConfig(),
    http.Client? httpClient,
  }) : _api = SolidChatApiClient(config.apiUrl, httpClient: httpClient) {
    _realtime = SolidChatRealtime(
      config.apiUrl,
      SolidChatRealtimeCallbacks(
        onConnected: (connected) =>
            _update(_state.copyWith(connected: connected)),
        onMessage: _mergeMessage,
        onConversation: _handleConversationUpdate,
        onTyping: _handleTyping,
        onPresence: (presence) {
          final site = _state.site;
          if (site != null) {
            _update(
              _state.copyWith(site: site.copyWith(presenceStatus: presence)),
            );
          }
        },
        onError: _publishError,
      ),
    );
  }

  final SolidChatConfig config;
  final SolidChatApiClient _api;
  late final SolidChatRealtime _realtime;
  SolidChatStorage? _storage;
  SolidChatState _state = const SolidChatState();
  Timer? _agentTimeoutTimer;
  Timer? _agentCountdownTimer;
  bool _agentTimeoutRunning = false;
  bool _initialized = false;
  bool _disposed = false;
  SolidChatSessionContext _lastContext = const SolidChatSessionContext();

  SolidChatState get state => _state;

  Future<void> initialize({
    SolidChatSessionContext context = const SolidChatSessionContext(),
  }) async {
    if (_initialized || _state.loading) return;
    _lastContext = context;
    _update(_state.copyWith(loading: true, error: null));
    try {
      _storage ??= await SolidChatStorage.create(config.siteId);
      await _createSession(context);
      _initialized = true;
    } catch (error) {
      _publishError(_asException(error));
    } finally {
      _update(_state.copyWith(loading: false));
    }
  }

  Future<void> retry() async {
    _initialized = false;
    _update(_state.copyWith(error: null));
    await initialize(context: _lastContext);
  }

  Future<void> _createSession(SolidChatSessionContext context) async {
    final storage = _requireStorage();
    final session = await _api.postMap(
      '/api/v1/widget/session',
      _sessionPayload(context),
    );
    final token = session['visitorToken'] as String;
    storage.visitorToken = token;
    _api.token = token;
    _update(
      _state.copyWith(
        site: SiteConfig.fromJson(session['site'] as Map<String, dynamic>),
      ),
    );
    await _restoreOrCreateConversation();
  }

  Map<String, dynamic> _sessionPayload(SolidChatSessionContext context) => {
        'siteId': config.siteId,
        'visitorId': _requireStorage().visitorId,
        'language': config.language,
        if (context.pageUrl != null) 'pageUrl': context.pageUrl,
        if (context.pageTitle != null) 'pageTitle': context.pageTitle,
        if (context.referrer != null) 'referrer': context.referrer,
        if (context.utm != null) 'utm': context.utm!.toJson(),
        'device': (context.device ??
                SolidChatDevice(timezone: DateTime.now().timeZoneName))
            .toJson(),
      };

  Future<void> _restoreOrCreateConversation() async {
    final storage = _requireStorage();
    final existingId = storage.conversationId;
    if (existingId != null) {
      try {
        await _loadConversation(existingId);
        if (!_state.ended) {
          return;
        }
        _realtime.disconnect();
        storage.conversationId = null;
        await storage.clearLead();
        await storage.clearTickets();
      } catch (_) {
        storage.conversationId = null;
      }
    }
    _update(
      _state.copyWith(
        conversation: null,
        messages: const [],
        leadSubmitted: false,
        ticketNumber: null,
      ),
    );
  }

  Future<Conversation> _createNewConversation() async {
    final conversation = Conversation.fromJson(
      await _api.postMap('/api/v1/widget/conversations?forceNew=true'),
    );
    _setConversation(conversation, const []);
    return conversation;
  }

  Future<void> _loadConversation(String id) async {
    final detail = await _api.getMap('/api/v1/widget/conversations/$id');
    final conversation = Conversation.fromJson(
      detail['conversation'] as Map<String, dynamic>,
    );
    final messages = (detail['messages'] as List<dynamic>? ?? const [])
        .whereType<Map<String, dynamic>>()
        .map(ChatMessage.fromJson)
        .toList(growable: false);
    _setConversation(conversation, messages);
  }

  void _setConversation(Conversation conversation, List<ChatMessage> messages) {
    final storage = _requireStorage();
    storage.conversationId = conversation.id;
    final awaitingAgent = _isAwaitingAgentReply(conversation);
    final startedAt =
        awaitingAgent ? storage.agentRequestStartedAt(conversation.id) : null;
    if (!awaitingAgent) {
      unawaited(storage.clearAgentRequestStartedAt(conversation.id));
    }
    _update(
      _state.copyWith(
        conversation: conversation,
        messages: messages,
        leadSubmitted: storage.leadSubmitted(conversation.id),
        ticketNumber: storage.ticketNumber(conversation.id),
        agentRequested: false,
        agentRequestStartedAt: startedAt,
        agentReplyRemainingSeconds:
            startedAt == null ? null : _remainingAgentSeconds(startedAt),
      ),
    );
    if (startedAt != null) {
      _scheduleAgentTimeout(conversation.id, startedAt);
    }
    final token = storage.visitorToken;
    if (token != null) {
      _realtime.connect(visitorToken: token, conversationId: conversation.id);
    }
  }

  Future<void> sendMessage(String content) async {
    final text = content.trim();
    if (text.isEmpty || text.length > 4000) {
      throw const SolidChatException(
        'VALIDATION_ERROR',
        'Pesan harus berisi 1-4000 karakter.',
      );
    }
    final conversation = _requireConversation();
    final clientId = solidChatUuid();
    _mergeMessage(
      ChatMessage(
        id: clientId,
        conversationId: conversation.id,
        senderType: 'VISITOR',
        messageType: 'TEXT',
        content: text,
        createdAt: DateTime.now().toUtc().toIso8601String(),
        clientMessageId: clientId,
      ),
    );
    try {
      final result = await _api.postMap(
        '/api/v1/widget/conversations/${conversation.id}/messages',
        {'content': text, 'clientMessageId': clientId, 'messageType': 'TEXT'},
      );
      _mergeMessage(ChatMessage.fromJson(result));
    } catch (error) {
      _publishError(_asException(error));
      rethrow;
    }
  }

  Future<void> uploadImage({
    required Uint8List bytes,
    required String fileName,
    required String mimeType,
    String caption = '',
  }) async {
    final conversation = _requireConversation();
    if (conversation.handlerType != 'HUMAN') {
      throw const SolidChatException(
        'VALIDATION_ERROR',
        'Gambar hanya dapat dikirim saat ditangani agent.',
      );
    }
    try {
      final message = await _api.uploadImage(
        conversationId: conversation.id,
        bytes: bytes,
        fileName: fileName,
        mimeType: mimeType,
        caption: caption,
        clientMessageId: solidChatUuid(),
      );
      _mergeMessage(message);
    } catch (error) {
      _publishError(_asException(error));
      rethrow;
    }
  }

  Future<String> getAttachmentUrl(String attachmentId) async {
    if (attachmentId.trim().isEmpty) {
      throw const SolidChatException(
        'VALIDATION_ERROR',
        'Attachment ID tidak boleh kosong.',
      );
    }
    final conversation = _requireConversation();
    final result = await _api.getMap(
      '/api/v1/widget/conversations/${conversation.id}/attachments/$attachmentId/url',
    );
    return result['url'] as String;
  }

  Future<void> submitPreChat(PreChatInput input) async {
    final conversation = _state.conversation ?? await _createNewConversation();
    final lead = await _api
        .postMap('/api/v1/widget/conversations/${conversation.id}/lead', {
      'name': input.name.trim(),
      'email': input.email.trim(),
      'phone': input.phone.trim(),
      'consentGiven': input.consentGiven,
    });
    final targetId = lead['conversationId'] as String? ?? conversation.id;
    await _requireStorage().markLead(targetId);
    if (input.message.trim().isNotEmpty) {
      await _api.postMap('/api/v1/widget/conversations/$targetId/messages', {
        'content': input.message.trim(),
        'clientMessageId': solidChatUuid(),
        'messageType': 'TEXT',
      });
    }
    await _loadConversation(targetId);
  }

  Future<TicketResult> submitTicket(TicketInput input) async {
    final conversation = _state.conversation ?? await _createNewConversation();
    final result = TicketResult.fromJson(
      await _api.postMap(
        '/api/v1/widget/conversations/${conversation.id}/ticket',
        input.toJson(),
      ),
    );
    await _requireStorage().saveTicket(conversation.id, result.ticketNumber);
    _update(_state.copyWith(ticketNumber: result.ticketNumber));
    return result;
  }

  Future<void> requestAgent() async {
    final conversation = _requireConversation();
    final startedAt = DateTime.now().toUtc();
    await _requireStorage().saveAgentRequestStartedAt(
      conversation.id,
      startedAt,
    );
    _update(
      _state.copyWith(
        agentRequested: true,
        agentRequestStartedAt: startedAt,
        agentReplyRemainingSeconds: _agentTimeoutSeconds,
      ),
    );
    _scheduleAgentTimeout(conversation.id, startedAt);
    try {
      final updated = Conversation.fromJson(
        await _api.postMap(
          '/api/v1/widget/conversations/${conversation.id}/request-agent',
        ),
      );
      _update(_state.copyWith(conversation: updated));
      if (!_isAwaitingAgentReply(updated)) {
        _clearAgentWait(updated.id);
      }
    } catch (error) {
      _clearAgentWait(conversation.id);
      _publishError(_asException(error));
      rethrow;
    }
  }

  Future<void> closeConversation() async {
    final conversation = _requireConversation();
    final updated = Conversation.fromJson(
      await _api.postMap(
        '/api/v1/widget/conversations/${conversation.id}/close',
      ),
    );
    _clearAgentWait(conversation.id);
    _update(_state.copyWith(conversation: updated));
  }

  Future<void> startNewConversation() async {
    _agentTimeoutTimer?.cancel();
    _agentCountdownTimer?.cancel();
    _realtime.disconnect();
    final storage = _requireStorage();
    final previousId = _state.conversation?.id;
    if (previousId != null) {
      await storage.clearAgentRequestStartedAt(previousId);
    }
    storage.conversationId = null;
    await storage.clearLead();
    await storage.clearTickets();
    _update(
      _state.copyWith(
        conversation: null,
        messages: const [],
        leadSubmitted: false,
        ticketNumber: null,
        agentRequested: false,
        agentRequestStartedAt: null,
        agentReplyRemainingSeconds: null,
      ),
    );
  }

  Future<void> submitFeedback(int score, {String? comment}) async {
    if (score < 1 || score > 5) {
      throw const SolidChatException(
        'VALIDATION_ERROR',
        'Rating harus antara 1 dan 5.',
      );
    }
    final conversation = _requireConversation();
    await _api
        .postUnit('/api/v1/widget/conversations/${conversation.id}/feedback', {
      'score': score,
      if (comment?.trim().isNotEmpty == true) 'comment': comment!.trim(),
    });
  }

  void notifyTyping(bool typing) => _realtime.typing(typing);
  void markRead(String messageId) => _realtime.markRead(messageId);

  Future<void> clearTicketNotice() async {
    final conversation = _state.conversation;
    if (conversation != null) {
      await _requireStorage().clearTicket(conversation.id);
    }
    _update(_state.copyWith(ticketNumber: null));
  }

  Future<void> reset() async {
    _agentTimeoutTimer?.cancel();
    _agentCountdownTimer?.cancel();
    _realtime.disconnect();
    await _requireStorage().reset();
    _api.token = null;
    _initialized = false;
    _update(const SolidChatState());
  }

  int get _agentTimeoutSeconds {
    final configured = _state.site?.settings.agentReplyTimeoutSeconds ?? 60;
    return configured < 10 ? 10 : configured;
  }

  int _remainingAgentSeconds(DateTime startedAt) {
    final deadline = startedAt.add(Duration(seconds: _agentTimeoutSeconds));
    final milliseconds =
        deadline.difference(DateTime.now().toUtc()).inMilliseconds;
    if (milliseconds <= 0) return 0;
    final seconds = (milliseconds / 1000).ceil();
    return seconds > _agentTimeoutSeconds ? _agentTimeoutSeconds : seconds;
  }

  bool _isAwaitingAgentReply(Conversation conversation) =>
      (conversation.status == 'QUEUED' ||
          conversation.status == 'WAITING_AGENT' ||
          conversation.status == 'AGENT_ACTIVE') &&
      conversation.handlerType != 'AI';

  void _scheduleAgentTimeout(String conversationId, DateTime startedAt) {
    _agentTimeoutTimer?.cancel();
    _agentCountdownTimer?.cancel();
    void refreshCountdown() {
      final remaining = _remainingAgentSeconds(startedAt);
      _update(_state.copyWith(agentReplyRemainingSeconds: remaining));
      if (remaining == 0) {
        _agentCountdownTimer?.cancel();
      }
    }

    refreshCountdown();
    _agentCountdownTimer = Timer.periodic(
      const Duration(seconds: 1),
      (_) => refreshCountdown(),
    );
    final remaining = _remainingAgentSeconds(startedAt);
    _agentTimeoutTimer = Timer(
      Duration(seconds: remaining),
      () => unawaited(_fireAgentTimeout(conversationId)),
    );
  }

  Future<void> _fireAgentTimeout(String conversationId) async {
    if (_agentTimeoutRunning) return;
    _agentTimeoutRunning = true;
    try {
      for (var attempt = 0; attempt < 5; attempt += 1) {
        try {
          final result = await _api.postMap(
            '/api/v1/widget/conversations/$conversationId/agent-timeout',
          );
          final conversation = Conversation.fromJson(
            result['conversation'] as Map<String, dynamic>,
          );
          _update(_state.copyWith(conversation: conversation));
          if (result['restored'] == true || conversation.handlerType == 'AI') {
            _clearAgentWait(conversationId);
            await _loadConversation(conversationId);
            return;
          }
        } catch (_) {
          if (attempt == 4) return;
        }
        await Future<void>.delayed(const Duration(seconds: 3));
      }
    } finally {
      _agentTimeoutRunning = false;
    }
  }

  void _clearAgentWait(String conversationId) {
    _agentTimeoutTimer?.cancel();
    _agentCountdownTimer?.cancel();
    unawaited(
      _storage?.clearAgentRequestStartedAt(conversationId) ?? Future.value(),
    );
    _update(
      _state.copyWith(
        agentRequested: false,
        agentRequestStartedAt: null,
        agentReplyRemainingSeconds: null,
      ),
    );
  }

  void _mergeMessage(ChatMessage message) {
    final messages = [..._state.messages];
    final index = messages.indexWhere(
      (current) =>
          current.id == message.id ||
          (message.clientMessageId != null &&
              current.clientMessageId == message.clientMessageId),
    );
    if (index >= 0) {
      messages[index] = message;
    } else {
      messages.add(message);
    }
    _update(
      _state.copyWith(
        messages: List.unmodifiable(messages),
        aiTyping: message.senderType == 'AI' ? false : _state.aiTyping,
        agentRequested:
            message.senderType == 'AI' || message.senderType == 'AGENT'
                ? false
                : _state.agentRequested,
      ),
    );
    if (message.senderType == 'AI' || message.senderType == 'AGENT') {
      _clearAgentWait(message.conversationId);
    }
  }

  void _handleConversationUpdate(String? status, String? handlerType) {
    final conversation = _state.conversation;
    if (conversation == null) return;
    final updated = conversation.copyWith(
      status: status,
      handlerType: handlerType,
    );
    if (_isAwaitingAgentReply(updated)) {
      final startedAt = _state.agentRequestStartedAt ?? DateTime.now().toUtc();
      if (_state.agentRequestStartedAt == null) {
        unawaited(
          _requireStorage().saveAgentRequestStartedAt(updated.id, startedAt),
        );
      }
      _update(
        _state.copyWith(
          conversation: updated,
          agentRequestStartedAt: startedAt,
          agentReplyRemainingSeconds: _remainingAgentSeconds(startedAt),
        ),
      );
      _scheduleAgentTimeout(updated.id, startedAt);
      return;
    }
    if (updated.handlerType == 'AI') {
      _clearAgentWait(updated.id);
    }
    _update(
      _state.copyWith(
        conversation: updated,
        agentRequested:
            updated.handlerType == 'AI' || updated.handlerType == 'HUMAN'
                ? false
                : _state.agentRequested,
      ),
    );
  }

  void _handleTyping(String from, bool typing, String? senderName) {
    if (from == 'AGENT') {
      _update(
        _state.copyWith(
          agentTyping: typing,
          agentTypingName: typing ? senderName : null,
        ),
      );
    }
    if (from == 'AI') {
      _update(_state.copyWith(aiTyping: typing));
    }
  }

  Conversation _requireConversation() =>
      _state.conversation ??
      (throw const SolidChatException('NOT_READY', 'Conversation belum siap.'));
  SolidChatStorage _requireStorage() =>
      _storage ??
      (throw const SolidChatException('NOT_READY', 'Session belum siap.'));
  SolidChatException _asException(Object error) => error is SolidChatException
      ? error
      : SolidChatException('CLIENT_ERROR', error.toString());
  void _publishError(SolidChatException error) =>
      _update(_state.copyWith(error: error));
  void clearError() => _update(_state.copyWith(error: null));

  void _update(SolidChatState next) {
    if (_disposed) return;
    _state = next;
    notifyListeners();
  }

  @override
  void dispose() {
    _disposed = true;
    _agentTimeoutTimer?.cancel();
    _agentCountdownTimer?.cancel();
    _realtime.disconnect();
    _api.close();
    super.dispose();
  }
}
