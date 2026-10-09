const solidChatProductionApiUrl = 'https://live-chat.sg-berjangka.com';
const solidChatSolidGoldSiteId = 'solid-gold-main';

class SolidChatConfig {
  const SolidChatConfig({
    this.apiUrl = solidChatProductionApiUrl,
    this.siteId = solidChatSolidGoldSiteId,
    this.language = 'id',
  });

  final String apiUrl;
  final String siteId;
  final String language;
}

class SolidChatDevice {
  const SolidChatDevice({this.timezone, this.screenWidth, this.screenHeight});
  final String? timezone;
  final int? screenWidth;
  final int? screenHeight;

  Map<String, dynamic> toJson() => {
        if (timezone != null) 'timezone': timezone,
        if (screenWidth != null) 'screenWidth': screenWidth,
        if (screenHeight != null) 'screenHeight': screenHeight,
      };
}

class SolidChatUtm {
  const SolidChatUtm({this.source, this.medium, this.campaign});
  final String? source;
  final String? medium;
  final String? campaign;

  Map<String, dynamic> toJson() => {
        if (source != null) 'source': source,
        if (medium != null) 'medium': medium,
        if (campaign != null) 'campaign': campaign,
      };
}

class SolidChatSessionContext {
  const SolidChatSessionContext({
    this.pageUrl,
    this.pageTitle,
    this.referrer,
    this.utm,
    this.device,
  });

  final String? pageUrl;
  final String? pageTitle;
  final String? referrer;
  final SolidChatUtm? utm;
  final SolidChatDevice? device;
}

class SiteSettings {
  const SiteSettings({
    this.widgetEnabled = true,
    this.aiEnabled = true,
    this.humanChatEnabled = true,
    this.preChatFormEnabled = true,
    this.showAgentButton = true,
    this.agentButtonLabel = 'Hubungi Agent',
    this.allowAttachments = false,
    this.ratingFormEnabled = true,
    this.agentReplyTimeoutSeconds = 60,
  });

  final bool widgetEnabled;
  final bool aiEnabled;
  final bool humanChatEnabled;
  final bool preChatFormEnabled;
  final bool showAgentButton;
  final String agentButtonLabel;
  final bool allowAttachments;
  final bool ratingFormEnabled;
  final int agentReplyTimeoutSeconds;

  factory SiteSettings.fromJson(Map<String, dynamic>? json) => SiteSettings(
        widgetEnabled: json?['widgetEnabled'] as bool? ?? true,
        aiEnabled: json?['aiEnabled'] as bool? ?? true,
        humanChatEnabled: json?['humanChatEnabled'] as bool? ?? true,
        preChatFormEnabled: json?['preChatFormEnabled'] as bool? ?? true,
        showAgentButton: json?['showAgentButton'] as bool? ?? true,
        agentButtonLabel:
            json?['agentButtonLabel'] as String? ?? 'Hubungi Agent',
        allowAttachments: json?['allowAttachments'] as bool? ?? false,
        ratingFormEnabled: json?['ratingFormEnabled'] as bool? ?? true,
        agentReplyTimeoutSeconds:
            (json?['agentReplyTimeoutSeconds'] as num?)?.toInt() ?? 60,
      );
}

class SiteConfig {
  const SiteConfig({
    required this.siteId,
    required this.name,
    this.aiName = 'AI Assistant',
    this.logoUrl,
    this.widgetColor = '#D4AF37',
    this.greeting = '',
    this.offlineMessage = '',
    this.language = 'id',
    this.presenceStatus = 'OFFLINE',
    this.settings = const SiteSettings(),
  });

  final String siteId;
  final String name;
  final String aiName;
  final String? logoUrl;
  final String widgetColor;
  final String greeting;
  final String offlineMessage;
  final String language;
  final String presenceStatus;
  final SiteSettings settings;

  factory SiteConfig.fromJson(Map<String, dynamic> json) => SiteConfig(
        siteId: json['siteId'] as String,
        name: json['name'] as String,
        aiName: json['aiName'] as String? ?? 'AI Assistant',
        logoUrl: json['logoUrl'] as String?,
        widgetColor: json['widgetColor'] as String? ?? '#D4AF37',
        greeting: json['greeting'] as String? ?? '',
        offlineMessage: json['offlineMessage'] as String? ?? '',
        language: json['language'] as String? ?? 'id',
        presenceStatus: json['presenceStatus'] as String? ?? 'OFFLINE',
        settings:
            SiteSettings.fromJson(json['settings'] as Map<String, dynamic>?),
      );

  SiteConfig copyWith({String? presenceStatus}) => SiteConfig(
        siteId: siteId,
        name: name,
        aiName: aiName,
        logoUrl: logoUrl,
        widgetColor: widgetColor,
        greeting: greeting,
        offlineMessage: offlineMessage,
        language: language,
        presenceStatus: presenceStatus ?? this.presenceStatus,
        settings: settings,
      );
}

class Conversation {
  const Conversation({
    required this.id,
    required this.status,
    required this.handlerType,
    this.assignedAgentId,
  });
  final String id;
  final String status;
  final String handlerType;
  final String? assignedAgentId;

  factory Conversation.fromJson(Map<String, dynamic> json) => Conversation(
        id: json['id'] as String,
        status: json['status'] as String,
        handlerType: json['handlerType'] as String,
        assignedAgentId: json['assignedAgentId'] as String?,
      );

  Conversation copyWith({String? status, String? handlerType}) => Conversation(
        id: id,
        status: status ?? this.status,
        handlerType: handlerType ?? this.handlerType,
        assignedAgentId: assignedAgentId,
      );
}

class SolidChatAttachment {
  const SolidChatAttachment({
    required this.id,
    required this.fileName,
    required this.mimeType,
  });
  final String id;
  final String fileName;
  final String mimeType;

  factory SolidChatAttachment.fromJson(Map<String, dynamic> json) =>
      SolidChatAttachment(
        id: json['id'] as String,
        fileName: json['fileName'] as String? ?? 'attachment',
        mimeType: json['mimeType'] as String? ?? 'application/octet-stream',
      );
}

class ChatMessage {
  const ChatMessage({
    required this.id,
    required this.conversationId,
    required this.senderType,
    required this.messageType,
    required this.content,
    required this.createdAt,
    this.clientMessageId,
    this.senderName,
    this.attachments = const [],
  });

  final String id;
  final String conversationId;
  final String senderType;
  final String messageType;
  final String content;
  final String createdAt;
  final String? clientMessageId;
  final String? senderName;
  final List<SolidChatAttachment> attachments;

  factory ChatMessage.fromJson(Map<String, dynamic> json) => ChatMessage(
        id: json['id'] as String,
        conversationId: json['conversationId'] as String,
        senderType: json['senderType'] as String,
        messageType: json['messageType'] as String? ?? 'TEXT',
        content: json['content'] as String? ?? '',
        createdAt: json['createdAt'] as String,
        clientMessageId: json['clientMessageId'] as String?,
        senderName: json['senderName'] as String?,
        attachments: (json['attachments'] as List<dynamic>? ?? const [])
            .whereType<Map<String, dynamic>>()
            .map(SolidChatAttachment.fromJson)
            .toList(growable: false),
      );
}

class PreChatInput {
  const PreChatInput({
    required this.name,
    required this.email,
    required this.phone,
    required this.message,
    required this.consentGiven,
  });
  final String name;
  final String email;
  final String phone;
  final String message;
  final bool consentGiven;
}

class TicketInput {
  const TicketInput({
    required this.name,
    required this.email,
    required this.phone,
    required this.subject,
    required this.description,
    this.category,
  });
  final String name;
  final String email;
  final String phone;
  final String subject;
  final String description;
  final String? category;

  Map<String, dynamic> toJson() => {
        'name': name,
        'email': email,
        'phone': phone,
        'subject': subject,
        'description': description,
        if (category != null) 'category': category,
      };
}

class TicketResult {
  const TicketResult({required this.id, required this.ticketNumber});
  final String id;
  final String ticketNumber;
  factory TicketResult.fromJson(Map<String, dynamic> json) => TicketResult(
        id: json['id'] as String,
        ticketNumber: json['ticketNumber'] as String,
      );
}

class SolidChatException implements Exception {
  const SolidChatException(this.code, this.message, {this.httpStatus});
  final String code;
  final String message;
  final int? httpStatus;
  @override
  String toString() => message;
}

const _unset = Object();

class SolidChatState {
  const SolidChatState({
    this.loading = false,
    this.connected = false,
    this.site,
    this.conversation,
    this.messages = const [],
    this.agentTyping = false,
    this.agentTypingName,
    this.aiTyping = false,
    this.agentRequested = false,
    this.agentRequestStartedAt,
    this.agentReplyRemainingSeconds,
    this.leadSubmitted = false,
    this.ticketNumber,
    this.error,
  });

  final bool loading;
  final bool connected;
  final SiteConfig? site;
  final Conversation? conversation;
  final List<ChatMessage> messages;
  final bool agentTyping;
  final String? agentTypingName;
  final bool aiTyping;
  final bool agentRequested;
  final DateTime? agentRequestStartedAt;
  final int? agentReplyRemainingSeconds;
  final bool leadSubmitted;
  final String? ticketNumber;
  final SolidChatException? error;

  bool get ended =>
      conversation?.status == 'RESOLVED' || conversation?.status == 'CLOSED';
  bool get agentHandling => conversation?.handlerType == 'HUMAN';
  bool get agentConnecting =>
      (agentRequested || conversation?.status == 'QUEUED') &&
      !agentHandling &&
      !ended;
  bool get agentReplyTimedOut =>
      agentConnecting && agentReplyRemainingSeconds == 0;
  bool get offline => site?.settings.humanChatEnabled == false;
  bool get canRequestAgent =>
      site?.settings.showAgentButton != false &&
      (!agentConnecting || agentReplyTimedOut) &&
      !ended &&
      !agentHandling &&
      messages.any((message) => message.senderType == 'AI');

  SolidChatState copyWith({
    bool? loading,
    bool? connected,
    Object? site = _unset,
    Object? conversation = _unset,
    List<ChatMessage>? messages,
    bool? agentTyping,
    Object? agentTypingName = _unset,
    bool? aiTyping,
    bool? agentRequested,
    Object? agentRequestStartedAt = _unset,
    Object? agentReplyRemainingSeconds = _unset,
    bool? leadSubmitted,
    Object? ticketNumber = _unset,
    Object? error = _unset,
  }) =>
      SolidChatState(
        loading: loading ?? this.loading,
        connected: connected ?? this.connected,
        site: identical(site, _unset) ? this.site : site as SiteConfig?,
        conversation: identical(conversation, _unset)
            ? this.conversation
            : conversation as Conversation?,
        messages: messages ?? this.messages,
        agentTyping: agentTyping ?? this.agentTyping,
        agentTypingName: identical(agentTypingName, _unset)
            ? this.agentTypingName
            : agentTypingName as String?,
        aiTyping: aiTyping ?? this.aiTyping,
        agentRequested: agentRequested ?? this.agentRequested,
        agentRequestStartedAt: identical(agentRequestStartedAt, _unset)
            ? this.agentRequestStartedAt
            : agentRequestStartedAt as DateTime?,
        agentReplyRemainingSeconds:
            identical(agentReplyRemainingSeconds, _unset)
                ? this.agentReplyRemainingSeconds
                : agentReplyRemainingSeconds as int?,
        leadSubmitted: leadSubmitted ?? this.leadSubmitted,
        ticketNumber: identical(ticketNumber, _unset)
            ? this.ticketNumber
            : ticketNumber as String?,
        error: identical(error, _unset)
            ? this.error
            : error as SolidChatException?,
      );
}
