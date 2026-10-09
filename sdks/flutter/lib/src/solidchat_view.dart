import 'dart:async';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import 'models.dart';
import 'solidchat_controller.dart';

class SolidChatView extends StatefulWidget {
  const SolidChatView({
    super.key,
    this.config = const SolidChatConfig(),
    this.controller,
    this.identityToken,
    this.sessionContext = const SolidChatSessionContext(),
    this.onClose,
    this.title,
  });

  final SolidChatConfig config;
  final SolidChatController? controller;
  final String? identityToken;
  final SolidChatSessionContext sessionContext;
  final VoidCallback? onClose;
  final String? title;

  @override
  State<SolidChatView> createState() => _SolidChatViewState();
}

class _SolidChatViewState extends State<SolidChatView> {
  late final SolidChatController _controller;
  late final bool _ownsController;
  String? _ratedConversationId;

  @override
  void initState() {
    super.initState();
    _ownsController = widget.controller == null;
    _controller =
        widget.controller ?? SolidChatController(config: widget.config);
    _controller.initialize(
      context: widget.sessionContext,
      identityToken: widget.identityToken,
    );
  }

  @override
  void dispose() {
    if (_ownsController) _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
        animation: _controller,
        builder: (context, _) {
          final state = _controller.state;
          final accent = _parseColor(state.site?.widgetColor);
          return Theme(
            data: Theme.of(context).copyWith(
              colorScheme: ColorScheme.fromSeed(
                seedColor: accent,
                brightness: Brightness.dark,
              ),
              scaffoldBackgroundColor: const Color(0xFF2E2E2E),
            ),
            child: Scaffold(
              appBar: _ChatAppBar(
                title: widget.title ?? _headerName(state.site?.name),
                liveChatOnline: state.site?.settings.humanChatEnabled ?? false,
                onClose:
                    widget.onClose ?? () => Navigator.of(context).maybePop(),
                onEndChat: state.conversation != null && !state.ended
                    ? () => _confirmClose(context)
                    : null,
                onNewChat: state.ended ? _startNewConversation : null,
              ),
              body: SafeArea(child: _body(state, accent)),
            ),
          );
        },
      );

  Widget _body(SolidChatState state, Color accent) {
    if (state.loading && state.site == null) {
      return Center(child: CircularProgressIndicator(color: accent));
    }
    if (state.site == null && state.error != null) {
      return _ErrorState(
        message: state.error!.message,
        onRetry: _controller.retry,
        accent: accent,
      );
    }
    if (state.site?.settings.widgetEnabled == false) {
      return _UnavailableState(message: state.site?.offlineMessage);
    }
    if (state.offline && !state.leadSubmitted) {
      return _TicketForm(controller: _controller, state: state, accent: accent);
    }
    if (!state.leadSubmitted) {
      return _PreChatForm(controller: _controller, accent: accent);
    }
    if (state.offline && !state.ended) {
      return _TicketForm(controller: _controller, state: state, accent: accent);
    }
    final conversationId = state.conversation?.id;
    final showRating = state.ended &&
        state.site?.settings.ratingFormEnabled != false &&
        conversationId != null &&
        _ratedConversationId != conversationId;
    return Stack(
      children: [
        Column(
          children: [
            if (state.error != null)
              _ErrorBanner(
                message: state.error!.message,
                onDismiss: _controller.clearError,
              ),
            Expanded(
              child: _MessageList(
                controller: _controller,
                state: state,
                accent: accent,
              ),
            ),
            if (state.ended)
              _EndedActions(
                accent: accent,
                onNewConversation: _startNewConversation,
              )
            else
              _Composer(controller: _controller, state: state, accent: accent),
          ],
        ),
        if (showRating)
          Positioned.fill(
            child: ColoredBox(
              color: Colors.black.withAlpha(191),
              child: Center(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: _RatingSheet(
                    controller: _controller,
                    accent: accent,
                    onSubmitted: () => setState(
                      () => _ratedConversationId = conversationId,
                    ),
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }

  Future<void> _startNewConversation() async {
    setState(() => _ratedConversationId = null);
    await _controller.startNewConversation();
  }

  Future<void> _confirmClose(BuildContext context) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Akhiri percakapan?'),
        content: const Text(
          'Anda masih dapat melihat riwayat dan memulai percakapan baru.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Batal'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Akhiri'),
          ),
        ],
      ),
    );
    if (confirmed == true && context.mounted) {
      await _run(context, _controller.closeConversation);
    }
  }
}

class _ChatAppBar extends StatelessWidget implements PreferredSizeWidget {
  const _ChatAppBar({
    required this.title,
    required this.liveChatOnline,
    required this.onClose,
    this.onEndChat,
    this.onNewChat,
  });
  final String title;
  final bool liveChatOnline;
  final VoidCallback onClose;
  final VoidCallback? onEndChat;
  final VoidCallback? onNewChat;

  @override
  Size get preferredSize => const Size.fromHeight(64);

  @override
  Widget build(BuildContext context) => AppBar(
        toolbarHeight: 64,
        automaticallyImplyLeading: false,
        flexibleSpace: const DecoratedBox(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [Color(0xFF3A3A3A), Color(0xFF2E2E2E), Color(0xFF222222)],
              stops: [0, .55, 1],
            ),
          ),
        ),
        titleSpacing: 16,
        title: Row(
          children: [
            ClipOval(
              child: Image.asset(
                'packages/solidchat_flutter/assets/icon-header.png',
                width: 28,
                height: 28,
                fit: BoxFit.cover,
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  Row(
                    children: [
                      Container(
                        width: 6,
                        height: 6,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: liveChatOnline
                              ? const Color(0xFF34D399)
                              : const Color(0xFF71717A),
                        ),
                      ),
                      const SizedBox(width: 4),
                      Text(
                        liveChatOnline
                            ? 'Live Chat Online'
                            : 'Live Chat Offline',
                        style: const TextStyle(
                            fontSize: 11, color: Color(0xFFA1A1AA)),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
        actions: [
          if (onEndChat != null)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 12),
              child: IconButton(
                tooltip: 'Akhiri chat',
                onPressed: onEndChat,
                style: IconButton.styleFrom(
                  side: const BorderSide(color: Color(0xFFEF4444)),
                  backgroundColor: const Color(0x33EF4444),
                  foregroundColor: const Color(0xFFEF4444),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(6)),
                ),
                icon: const Icon(Icons.logout, size: 17),
              ),
            ),
          if (onNewChat != null)
            IconButton(
              tooltip: 'Pesan baru',
              onPressed: onNewChat,
              icon: const Icon(Icons.add_comment_outlined, size: 18),
            ),
          IconButton(
            tooltip: 'Tutup chat',
            onPressed: onClose,
            style:
                IconButton.styleFrom(backgroundColor: const Color(0xFF3F3F46)),
            icon: const Icon(Icons.close, size: 18),
          ),
          const SizedBox(width: 8),
        ],
      );
}

class _MessageList extends StatefulWidget {
  const _MessageList({
    required this.controller,
    required this.state,
    required this.accent,
  });
  final SolidChatController controller;
  final SolidChatState state;
  final Color accent;

  @override
  State<_MessageList> createState() => _MessageListState();
}

class _MessageListState extends State<_MessageList> {
  final _scrollController = ScrollController();

  @override
  void didUpdateWidget(covariant _MessageList oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.state.messages.length != widget.state.messages.length) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (_scrollController.hasClients) {
          _scrollController.animateTo(
            _scrollController.position.maxScrollExtent,
            duration: const Duration(milliseconds: 220),
            curve: Curves.easeOut,
          );
        }
      });
      final last =
          widget.state.messages.isEmpty ? null : widget.state.messages.last;
      if (last != null && last.senderType != 'VISITOR') {
        widget.controller.markRead(last.id);
      }
    }
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final messages = widget.state.messages;
    return DecoratedBox(
      decoration: const BoxDecoration(
        color: Color(0xFF2E2E2E),
        image: DecorationImage(
          image: AssetImage(
            'packages/solidchat_flutter/assets/conversation-bg.png',
          ),
          fit: BoxFit.cover,
          colorFilter: ColorFilter.mode(
            Color(0x992E2E2E),
            BlendMode.srcATop,
          ),
        ),
      ),
      child: ListView(
        controller: _scrollController,
        padding: const EdgeInsets.all(16),
        children: [
          for (final message in messages) ...[
            _MessageBubble(
              controller: widget.controller,
              message: message,
              aiName: widget.state.site?.aiName ?? 'AI Assistant',
            ),
            const SizedBox(height: 12),
          ],
          if (widget.state.agentConnecting &&
              !widget.state.agentReplyTimedOut) ...[
            _ConnectingAgentBadge(
              remainingSeconds: widget.state.agentReplyRemainingSeconds,
            ),
            const SizedBox(height: 12),
          ],
          if (widget.state.aiTyping) ...[
            _TypingBubble(
              name: widget.state.site?.aiName ?? 'AI Assistant',
              senderType: 'AI',
            ),
            const SizedBox(height: 12),
          ],
          if (widget.state.agentTyping)
            _TypingBubble(
              name: widget.state.agentTypingName?.trim().isNotEmpty == true
                  ? widget.state.agentTypingName!
                  : 'Agent',
              senderType: 'AGENT',
            ),
        ],
      ),
    );
  }
}

class _MessageBubble extends StatelessWidget {
  const _MessageBubble({
    required this.controller,
    required this.message,
    required this.aiName,
  });
  final SolidChatController controller;
  final ChatMessage message;
  final String aiName;

  @override
  Widget build(BuildContext context) {
    final visitor =
        message.senderType == 'VISITOR' || message.senderType == 'CUSTOMER';
    if (message.senderType == 'SYSTEM') {
      return Text(
        '~ ${message.content} ~',
        textAlign: TextAlign.center,
        style: const TextStyle(fontSize: 11, color: Color(0xFF71717A)),
      );
    }
    final ai = message.senderType == 'AI';
    final roleColor = visitor
        ? const Color(0xFFEAB308)
        : ai
            ? const Color(0xFFF97316)
            : const Color(0xFF22C55E);
    final senderLabel = visitor
        ? 'You'
        : ai
            ? aiName
            : message.senderName?.trim().isNotEmpty == true
                ? message.senderName!
                : 'Agent';
    return Align(
      alignment: visitor ? Alignment.centerRight : Alignment.centerLeft,
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxWidth: MediaQuery.sizeOf(context).width * .82,
        ),
        child: Column(
          crossAxisAlignment:
              visitor ? CrossAxisAlignment.end : CrossAxisAlignment.start,
          children: [
            Padding(
              padding: EdgeInsets.only(
                left: visitor ? 0 : 4,
                right: visitor ? 4 : 0,
              ),
              child: Text(
                senderLabel,
                style: TextStyle(
                  color: roleColor,
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
            const SizedBox(height: 8),
            Container(
              padding: message.attachments.isNotEmpty
                  ? const EdgeInsets.all(6)
                  : EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: visitor ? 12 : 16,
                    ),
              decoration: BoxDecoration(
                color: roleColor.withAlpha(38),
                border: Border.all(color: roleColor),
                borderRadius: BorderRadius.only(
                  topLeft: Radius.circular(visitor ? 16 : 4),
                  topRight: Radius.circular(visitor ? 4 : 16),
                  bottomLeft: const Radius.circular(16),
                  bottomRight: const Radius.circular(16),
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  for (final attachment in message.attachments)
                    _AttachmentImage(
                      controller: controller,
                      attachment: attachment,
                    ),
                  if (message.content.trim().isNotEmpty)
                    Padding(
                      padding: message.attachments.isNotEmpty
                          ? const EdgeInsets.fromLTRB(6, 6, 6, 2)
                          : EdgeInsets.zero,
                      child: visitor
                          ? Text(
                              message.content,
                              style: const TextStyle(
                                color: Colors.white,
                                height: 1.45,
                                fontSize: 14,
                              ),
                            )
                          : _RichMessageText(message.content),
                    ),
                ],
              ),
            ),
            const SizedBox(height: 6),
            Padding(
              padding: EdgeInsets.only(
                left: visitor ? 0 : 4,
                right: visitor ? 4 : 0,
              ),
              child: Text(
                _formatTime(message.createdAt),
                style: const TextStyle(fontSize: 11, color: Colors.white38),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _AttachmentImage extends StatelessWidget {
  const _AttachmentImage({required this.controller, required this.attachment});
  final SolidChatController controller;
  final SolidChatAttachment attachment;

  @override
  Widget build(BuildContext context) => FutureBuilder<String>(
        future: controller.getAttachmentUrl(attachment.id),
        builder: (context, snapshot) {
          if (snapshot.hasData) {
            return Padding(
              padding: const EdgeInsets.only(bottom: 7),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(10),
                child: Image.network(
                  snapshot.data!,
                  width: 260,
                  height: 180,
                  fit: BoxFit.cover,
                  errorBuilder: (_, __, ___) => const _AttachmentPlaceholder(),
                ),
              ),
            );
          }
          return const SizedBox.shrink();
        },
      );
}

class _AttachmentPlaceholder extends StatelessWidget {
  const _AttachmentPlaceholder();
  @override
  Widget build(BuildContext context) => const SizedBox.shrink();
}

class _RichMessageText extends StatelessWidget {
  const _RichMessageText(this.content);
  final String content;

  @override
  Widget build(BuildContext context) {
    final lines = content.replaceAll('\r\n', '\n').split('\n');
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (var index = 0; index < lines.length; index += 1)
          if (lines[index].trim().isNotEmpty)
            Padding(
              padding: EdgeInsets.only(top: index == 0 ? 0 : 4),
              child: Text.rich(
                TextSpan(
                    children: _inlineSpans(_decorateListLine(lines[index]))),
                style: const TextStyle(
                  color: Colors.white,
                  height: 1.45,
                  fontSize: 14,
                ),
              ),
            ),
      ],
    );
  }

  String _decorateListLine(String line) {
    final trimmed = line.trim();
    if (RegExp(r'^[-•]\s+').hasMatch(trimmed)) {
      return '• ${trimmed.replaceFirst(RegExp(r'^[-•]\s+'), '')}';
    }
    return trimmed;
  }

  List<InlineSpan> _inlineSpans(String value) {
    final pattern = RegExp(
      r'(\*\*[^*]+\*\*|\*[^*]+\*|_[^_]+_|`[^`]+`|https://[^\s<]+)',
    );
    final spans = <InlineSpan>[];
    var cursor = 0;
    for (final match in pattern.allMatches(value)) {
      if (match.start > cursor) {
        spans.add(TextSpan(text: value.substring(cursor, match.start)));
      }
      final token = match.group(0)!;
      if (token.startsWith('**')) {
        spans.add(
          TextSpan(
            text: token.substring(2, token.length - 2),
            style: const TextStyle(fontWeight: FontWeight.w700),
          ),
        );
      } else if (token.startsWith('`')) {
        spans.add(
          TextSpan(
            text: token.substring(1, token.length - 1),
            style: const TextStyle(
              fontFamily: 'monospace',
              backgroundColor: Color(0x33000000),
            ),
          ),
        );
      } else if (token.startsWith('https://')) {
        spans.add(
          TextSpan(
            text: token,
            style: const TextStyle(
              color: Color(0xFF7DD3FC),
              decoration: TextDecoration.underline,
            ),
          ),
        );
      } else {
        spans.add(
          TextSpan(
            text: token.substring(1, token.length - 1),
            style: const TextStyle(fontStyle: FontStyle.italic),
          ),
        );
      }
      cursor = match.end;
    }
    if (cursor < value.length) {
      spans.add(TextSpan(text: value.substring(cursor)));
    }
    return spans;
  }
}

class _TypingBubble extends StatefulWidget {
  const _TypingBubble({required this.name, required this.senderType});
  final String name;
  final String senderType;

  @override
  State<_TypingBubble> createState() => _TypingBubbleState();
}

class _TypingBubbleState extends State<_TypingBubble>
    with SingleTickerProviderStateMixin {
  late final AnimationController _animation;

  @override
  void initState() {
    super.initState();
    _animation = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    )..repeat();
  }

  @override
  void dispose() {
    _animation.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final color = widget.senderType == 'AI'
        ? const Color(0xFFF97316)
        : const Color(0xFF22C55E);
    return Align(
      alignment: Alignment.centerLeft,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(left: 4),
            child: Text(
              widget.name,
              style: TextStyle(
                color: color,
                fontSize: 12,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 13),
            decoration: BoxDecoration(
              color: color.withAlpha(38),
              border: Border.all(color: color),
              borderRadius: const BorderRadius.only(
                topLeft: Radius.circular(4),
                topRight: Radius.circular(16),
                bottomLeft: Radius.circular(16),
                bottomRight: Radius.circular(16),
              ),
            ),
            child: AnimatedBuilder(
              animation: _animation,
              builder: (context, _) => Row(
                mainAxisSize: MainAxisSize.min,
                children: List.generate(3, (index) {
                  final phase = (_animation.value + index * .2) % 1;
                  final opacity =
                      phase < .5 ? .35 + phase * 1.3 : 1.65 - phase * 1.3;
                  return Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 2),
                    child: Opacity(
                      opacity: opacity.clamp(.35, 1),
                      child: Container(
                        width: 6,
                        height: 6,
                        decoration: BoxDecoration(
                          color: color,
                          shape: BoxShape.circle,
                        ),
                      ),
                    ),
                  );
                }),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ConnectingAgentBadge extends StatelessWidget {
  const _ConnectingAgentBadge({required this.remainingSeconds});
  final int? remainingSeconds;

  @override
  Widget build(BuildContext context) {
    final seconds = remainingSeconds;
    final countdown = seconds == null
        ? null
        : '${(seconds ~/ 60).toString().padLeft(2, '0')}:${(seconds % 60).toString().padLeft(2, '0')}';
    return Center(
      child: Container(
        constraints: BoxConstraints(
          maxWidth: MediaQuery.sizeOf(context).width * .85,
        ),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
        decoration: BoxDecoration(
          color: const Color(0xF2212124),
          border: Border.all(color: const Color(0x33F59E0B)),
          borderRadius: BorderRadius.circular(16),
        ),
        child: Column(
          children: [
            const Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                SizedBox.square(
                  dimension: 12,
                  child: CircularProgressIndicator(
                    strokeWidth: 1.5,
                    color: Color(0xFFFCD34D),
                  ),
                ),
                SizedBox(width: 8),
                Text(
                  'Sedang menghubungkan dengan agent',
                  style: TextStyle(fontSize: 11, color: Color(0xFFD4D4D8)),
                ),
              ],
            ),
            const SizedBox(height: 5),
            Text(
              countdown == null
                  ? 'Jika agent belum membalas, AI akan membantu lagi sebentar lagi.'
                  : 'Jika agent belum membalas, AI akan membantu lagi dalam $countdown.',
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 10, color: Color(0xFFA1A1AA)),
            ),
          ],
        ),
      ),
    );
  }
}

class _Composer extends StatefulWidget {
  const _Composer({
    required this.controller,
    required this.state,
    required this.accent,
  });
  final SolidChatController controller;
  final SolidChatState state;
  final Color accent;

  @override
  State<_Composer> createState() => _ComposerState();
}

class _ComposerState extends State<_Composer> {
  final _textController = TextEditingController();
  final _focusNode = FocusNode();
  Timer? _typingTimer;
  XFile? _pendingImage;
  Uint8List? _pendingImageBytes;
  String? _uploadError;
  bool _sending = false;

  bool get _disabled => !widget.state.connected || _sending;
  bool get _canUpload =>
      widget.state.agentHandling &&
      widget.state.site?.settings.allowAttachments == true;

  @override
  void didUpdateWidget(covariant _Composer oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (!_canUpload && _pendingImage != null) {
      _clearPendingImage();
    }
  }

  @override
  void dispose() {
    _typingTimer?.cancel();
    _textController.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final text = _textController.text.trim();
    if (_disabled || (text.isEmpty && _pendingImage == null)) return;
    setState(() => _sending = true);
    final stagedImage = _pendingImage;
    final stagedBytes = _pendingImageBytes;
    widget.controller.notifyTyping(false);
    try {
      if (stagedImage != null && stagedBytes != null) {
        await widget.controller.uploadImage(
          bytes: stagedBytes,
          fileName: stagedImage.name,
          mimeType: stagedImage.mimeType ?? _mimeFromName(stagedImage.name),
          caption: text,
        );
        _clearPendingImage();
      } else {
        _textController.clear();
        await widget.controller.sendMessage(text);
      }
      _textController.clear();
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _uploadError = error is SolidChatException
            ? error.message
            : 'Gagal mengirim gambar. Coba lagi.';
      });
      if (stagedImage == null) _textController.text = text;
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  Future<void> _pickImage() async {
    try {
      final file = await ImagePicker().pickImage(
        source: ImageSource.gallery,
        imageQuality: 88,
        maxWidth: 2048,
      );
      if (file == null) return;
      final mimeType = file.mimeType ?? _mimeFromName(file.name);
      if (!const ['image/png', 'image/jpeg', 'image/webp'].contains(mimeType)) {
        setState(
            () => _uploadError = 'Format gambar harus PNG, JPEG, atau WEBP.');
        return;
      }
      if (await file.length() > 10 * 1024 * 1024) {
        setState(() => _uploadError = 'Ukuran gambar maksimal 10 MB.');
        return;
      }
      final bytes = await file.readAsBytes();
      if (!mounted) return;
      setState(() {
        _pendingImage = file;
        _pendingImageBytes = bytes;
        _uploadError = null;
      });
    } catch (error) {
      if (mounted) _showError(context, error);
    }
  }

  void _clearPendingImage() {
    if (!mounted) return;
    setState(() {
      _pendingImage = null;
      _pendingImageBytes = null;
      _uploadError = null;
    });
  }

  void _handleTyping(String value) {
    widget.controller.notifyTyping(true);
    _typingTimer?.cancel();
    _typingTimer = Timer(
      const Duration(milliseconds: 1500),
      () => widget.controller.notifyTyping(false),
    );
    setState(() {});
  }

  Future<void> _showEmojiPicker() async {
    const emojis = [
      '😀',
      '😁',
      '😂',
      '😊',
      '😍',
      '🥰',
      '😎',
      '🤔',
      '😢',
      '🙏',
      '👍',
      '👏',
      '✅',
      '❤️',
      '🎉',
      '🔥',
      '📈',
      '💰',
      '📞',
      '📌',
      '⭐',
      '💡',
      '🤝',
      '🚀',
    ];
    final selected = await showModalBottomSheet<String>(
      context: context,
      backgroundColor: const Color(0xFF27272A),
      builder: (context) => SafeArea(
        child: GridView.count(
          shrinkWrap: true,
          padding: const EdgeInsets.all(16),
          crossAxisCount: 8,
          children: [
            for (final emoji in emojis)
              InkWell(
                onTap: () => Navigator.pop(context, emoji),
                borderRadius: BorderRadius.circular(8),
                child: Center(
                  child: Text(emoji, style: const TextStyle(fontSize: 25)),
                ),
              ),
          ],
        ),
      ),
    );
    if (selected == null || !mounted) return;
    final selection = _textController.selection;
    final start =
        selection.isValid ? selection.start : _textController.text.length;
    final end = selection.isValid ? selection.end : start;
    final current = _textController.text;
    _textController.text = current.replaceRange(start, end, selected);
    _textController.selection = TextSelection.collapsed(
      offset: start + selected.length,
    );
    _handleTyping(_textController.text);
    _focusNode.requestFocus();
  }

  @override
  Widget build(BuildContext context) => Material(
        color: const Color(0xFF2E2E2E),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (widget.state.canRequestAgent)
                Align(
                  alignment: Alignment.centerLeft,
                  child: TextButton.icon(
                    onPressed: () =>
                        _run(context, widget.controller.requestAgent),
                    style: TextButton.styleFrom(
                      foregroundColor: const Color(0xFFFACC15),
                      padding: const EdgeInsets.only(bottom: 8),
                      minimumSize: Size.zero,
                      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    ),
                    icon: const Icon(Icons.headset_mic_outlined, size: 14),
                    label: Text(
                      widget.state.site?.settings.agentButtonLabel
                                  .trim()
                                  .isNotEmpty ==
                              true
                          ? widget.state.site!.settings.agentButtonLabel
                          : 'Hubungi Agent Kami',
                      style: const TextStyle(
                        fontSize: 12,
                        decoration: TextDecoration.underline,
                        decorationStyle: TextDecorationStyle.dotted,
                      ),
                    ),
                  ),
                ),
              if (_pendingImageBytes != null)
                Container(
                  margin: const EdgeInsets.only(bottom: 8),
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: const Color(0xFF18181B),
                    border: Border.all(color: const Color(0xFF3F3F46)),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Row(
                    children: [
                      ClipRRect(
                        borderRadius: BorderRadius.circular(8),
                        child: Image.memory(
                          _pendingImageBytes!,
                          width: 56,
                          height: 56,
                          fit: BoxFit.cover,
                        ),
                      ),
                      const SizedBox(width: 8),
                      const Expanded(
                        child: Text(
                          'Gambar akan dikirim bersama pesan',
                          style:
                              TextStyle(fontSize: 12, color: Color(0xFFA1A1AA)),
                        ),
                      ),
                      IconButton(
                        tooltip: 'Hapus gambar',
                        onPressed: _sending ? null : _clearPendingImage,
                        icon: const Icon(Icons.close, size: 18),
                      ),
                    ],
                  ),
                ),
              Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  if (_canUpload)
                    Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: IconButton.outlined(
                        tooltip: 'Lampirkan gambar',
                        onPressed: _disabled || _pendingImage != null
                            ? null
                            : _pickImage,
                        icon: const Icon(Icons.add_photo_alternate_outlined,
                            size: 18),
                      ),
                    ),
                  Expanded(
                    child: Stack(
                      alignment: Alignment.bottomRight,
                      children: [
                        TextField(
                          controller: _textController,
                          focusNode: _focusNode,
                          style: const TextStyle(color: Colors.white),
                          cursorColor: Color(0xFFD4AF37),
                          minLines: 1,
                          maxLines: 3,
                          maxLength: 4000,
                          enabled: !_disabled,
                          onChanged: _handleTyping,
                          decoration: InputDecoration(
                            counterText: '',
                            hintText: _pendingImage == null
                                ? 'Tulis pesan...'
                                : 'Tambahkan pesan (opsional)...',
                            hintStyle:
                                const TextStyle(color: Color(0xFF71717A)),
                            filled: true,
                            fillColor: const Color(0xFF18181B),
                            contentPadding:
                                const EdgeInsets.fromLTRB(12, 12, 42, 12),
                            enabledBorder: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(12),
                              borderSide:
                                  const BorderSide(color: Color(0xFF3F3F46)),
                            ),
                            focusedBorder: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(12),
                              borderSide:
                                  const BorderSide(color: Color(0xFFD4AF37)),
                            ),
                            disabledBorder: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(12),
                              borderSide:
                                  const BorderSide(color: Color(0xFF3F3F46)),
                            ),
                          ),
                        ),
                        IconButton(
                          tooltip: 'Pilih emoji',
                          onPressed: _disabled ? null : _showEmojiPicker,
                          icon: const Icon(Icons.sentiment_satisfied_alt,
                              size: 20),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  IconButton.filled(
                    style: IconButton.styleFrom(
                      backgroundColor: widget.accent,
                      foregroundColor: const Color(0xFF111111),
                    ),
                    onPressed: _disabled ||
                            (_textController.text.trim().isEmpty &&
                                _pendingImage == null)
                        ? null
                        : _send,
                    icon: _sending
                        ? const SizedBox.square(
                            dimension: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.send, size: 18),
                  ),
                ],
              ),
              if (_sending && _pendingImage != null)
                const Padding(
                  padding: EdgeInsets.only(top: 8),
                  child: Text(
                    'Mengirim gambar...',
                    textAlign: TextAlign.center,
                    style: TextStyle(fontSize: 10, color: Color(0xFFA1A1AA)),
                  ),
                ),
              if (_uploadError != null)
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Text(
                    _uploadError!,
                    textAlign: TextAlign.center,
                    style:
                        const TextStyle(fontSize: 10, color: Color(0xFFF87171)),
                  ),
                ),
              const Padding(
                padding: EdgeInsets.only(top: 8),
                child: Text(
                  'Percakapan dapat dibaca oleh AI dan petugas resmi Solid Gold.',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 10, color: Color(0xFFE4E4E7)),
                ),
              ),
            ],
          ),
        ),
      );
}

class _PreChatForm extends StatefulWidget {
  const _PreChatForm({required this.controller, required this.accent});
  final SolidChatController controller;
  final Color accent;
  @override
  State<_PreChatForm> createState() => _PreChatFormState();
}

class _PreChatFormState extends State<_PreChatForm> {
  final _key = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _email = TextEditingController();
  final _phone = TextEditingController();
  final _message = TextEditingController();
  bool _consent = false;
  bool _submitting = false;

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    _phone.dispose();
    _message.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_key.currentState!.validate() || !_consent || _submitting) return;
    setState(() => _submitting = true);
    try {
      await widget.controller.submitPreChat(
        PreChatInput(
          name: _name.text,
          email: _email.text,
          phone: _phone.text,
          message: _message.text,
          consentGiven: true,
        ),
      );
    } catch (error) {
      if (mounted) _showError(context, error);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) => SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Form(
          key: _key,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text(
                'Sebelum memulai, boleh kami tahu sedikit tentang Anda?',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 14, color: Color(0xFFD4D4D8)),
              ),
              const SizedBox(height: 16),
              _FormField(
                  controller: _name, label: 'Nama Anda', validator: _required),
              _FormField(
                controller: _email,
                label: 'Email',
                keyboardType: TextInputType.emailAddress,
                validator: _emailValidator,
              ),
              _FormField(
                controller: _phone,
                label: 'No. Telepon / WhatsApp',
                keyboardType: TextInputType.phone,
                validator: _phoneValidator,
              ),
              _FormField(
                controller: _message,
                label: 'Tulis pesan pertama Anda',
                lines: 3,
                maxLength: 2000,
                validator: _required,
              ),
              CheckboxListTile(
                contentPadding: EdgeInsets.zero,
                activeColor: widget.accent,
                value: _consent,
                onChanged: (value) => setState(() => _consent = value ?? false),
                title: const Text(
                  'Saya menyetujui data ini digunakan sesuai kebijakan privasi Solid Gold.',
                  style: TextStyle(fontSize: 11, color: Color(0xFF71717A)),
                ),
                controlAffinity: ListTileControlAffinity.leading,
              ),
              const SizedBox(height: 8),
              FilledButton(
                style: FilledButton.styleFrom(
                  backgroundColor: widget.accent,
                  foregroundColor: Colors.black,
                  minimumSize: const Size.fromHeight(48),
                ),
                onPressed: _consent && !_submitting ? _submit : null,
                child: _submitting
                    ? const SizedBox.square(
                        dimension: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Text('Mulai Chat'),
              ),
            ],
          ),
        ),
      );
}

class _TicketForm extends StatefulWidget {
  const _TicketForm({
    required this.controller,
    required this.state,
    required this.accent,
  });
  final SolidChatController controller;
  final SolidChatState state;
  final Color accent;
  @override
  State<_TicketForm> createState() => _TicketFormState();
}

class _TicketFormState extends State<_TicketForm> {
  final _key = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _email = TextEditingController();
  final _phone = TextEditingController();
  final _subject = TextEditingController();
  final _description = TextEditingController();
  String _category = 'GENERAL';
  bool _submitting = false;

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    _phone.dispose();
    _subject.dispose();
    _description.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_key.currentState!.validate() || _submitting) return;
    setState(() => _submitting = true);
    try {
      await widget.controller.submitTicket(
        TicketInput(
          name: _name.text,
          email: _email.text,
          phone: _phone.text,
          subject: _subject.text,
          description: _description.text,
          category: _category,
        ),
      );
    } catch (error) {
      if (mounted) _showError(context, error);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (widget.state.ticketNumber != null) {
      return _CenteredContent(
        children: [
          Icon(Icons.mark_email_read_outlined, size: 64, color: widget.accent),
          const Text(
            'Tiket Anda sudah tercatat',
            style: TextStyle(fontSize: 21, fontWeight: FontWeight.w700),
          ),
          Text(
            widget.state.ticketNumber!,
            style: TextStyle(
              color: widget.accent,
              fontSize: 18,
              fontWeight: FontWeight.w700,
            ),
          ),
          const Text(
            'Tim kami akan menghubungi Anda melalui email atau telepon secepatnya.',
            textAlign: TextAlign.center,
            style: TextStyle(color: Colors.white60),
          ),
          OutlinedButton(
            onPressed: widget.controller.clearTicketNotice,
            child: const Text('Kirim tiket lain'),
          ),
        ],
      );
    }
    return SingleChildScrollView(
      padding: const EdgeInsets.all(22),
      child: Form(
        key: _key,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text(
              'Tim kami sedang offline',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 14, color: Color(0xFFE4E4E7)),
            ),
            const SizedBox(height: 4),
            Text(
              widget.state.site?.offlineMessage.isNotEmpty == true
                  ? widget.state.site!.offlineMessage
                  : 'Tinggalkan pesan Anda di bawah ini dan tim kami akan menghubungi Anda kembali.',
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 12, color: Color(0xFF71717A)),
            ),
            const SizedBox(height: 14),
            _FormField(
                controller: _name, label: 'Nama Anda', validator: _required),
            _FormField(
              controller: _email,
              label: 'Email',
              keyboardType: TextInputType.emailAddress,
              validator: _emailValidator,
            ),
            _FormField(
              controller: _phone,
              label: 'No. Telepon / WhatsApp',
              keyboardType: TextInputType.phone,
              validator: _phoneValidator,
            ),
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: DropdownButtonFormField<String>(
                // Keep compatibility with the package minimum, Flutter 3.19.
                // ignore: deprecated_member_use
                value: _category,
                style: const TextStyle(color: Colors.white, fontSize: 14),
                dropdownColor: const Color(0xFF18181B),
                decoration: _fieldDecoration('Kategori'),
                items: const [
                  DropdownMenuItem(
                      value: 'GENERAL', child: Text('Pertanyaan Umum')),
                  DropdownMenuItem(
                      value: 'SALES', child: Text('Penjualan / Harga')),
                  DropdownMenuItem(
                      value: 'SUPPORT', child: Text('Bantuan Teknis')),
                  DropdownMenuItem(value: 'COMPLAINT', child: Text('Keluhan')),
                ],
                onChanged: _submitting
                    ? null
                    : (value) => setState(() => _category = value ?? 'GENERAL'),
              ),
            ),
            _FormField(
              controller: _subject,
              label: 'Subjek',
              validator: _required,
            ),
            _FormField(
              controller: _description,
              label: 'Ceritakan kebutuhan Anda...',
              lines: 4,
              validator: (value) =>
                  (value?.trim().length ?? 0) < 5 ? 'Minimal 5 karakter' : null,
            ),
            const SizedBox(height: 8),
            FilledButton(
              style: FilledButton.styleFrom(
                backgroundColor: widget.accent,
                foregroundColor: Colors.black,
                minimumSize: const Size.fromHeight(48),
              ),
              onPressed: _submitting ? null : _submit,
              child: _submitting
                  ? const SizedBox.square(
                      dimension: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Text('Kirim Tiket'),
            ),
          ],
        ),
      ),
    );
  }
}

class _FormField extends StatelessWidget {
  const _FormField({
    required this.controller,
    required this.label,
    this.keyboardType,
    this.lines = 1,
    this.maxLength,
    this.validator,
  });
  final TextEditingController controller;
  final String label;
  final TextInputType? keyboardType;
  final int lines;
  final int? maxLength;
  final String? Function(String?)? validator;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: TextFormField(
          controller: controller,
          style: const TextStyle(color: Colors.white),
          cursorColor: const Color(0xFFD4AF37),
          keyboardType: keyboardType,
          minLines: lines,
          maxLines: lines,
          maxLength: maxLength,
          validator: validator,
          decoration: _fieldDecoration(label).copyWith(
            counterText: maxLength == null ? null : '',
          ),
        ),
      );
}

class _RatingSheet extends StatefulWidget {
  const _RatingSheet({
    required this.controller,
    required this.accent,
    required this.onSubmitted,
  });
  final SolidChatController controller;
  final Color accent;
  final VoidCallback onSubmitted;
  @override
  State<_RatingSheet> createState() => _RatingSheetState();
}

class _RatingSheetState extends State<_RatingSheet> {
  int _score = 0;
  final _comment = TextEditingController();
  bool _submitting = false;
  @override
  void dispose() {
    _comment.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() => _submitting = true);
    try {
      await widget.controller.submitFeedback(_score, comment: _comment.text);
      if (mounted) widget.onSubmitted();
    } catch (error) {
      if (mounted) _showError(context, error);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) => Container(
        constraints: const BoxConstraints(maxWidth: 420),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: const Color(0xF227272A),
          borderRadius: BorderRadius.circular(16),
          boxShadow: const [
            BoxShadow(
                color: Colors.black54, blurRadius: 24, offset: Offset(0, 10)),
          ],
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text(
              'Bagaimana pengalaman Anda dengan layanan kami?',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 14, color: Color(0xFFE4E4E7)),
            ),
            const SizedBox(height: 10),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: List.generate(
                5,
                (index) => IconButton(
                  onPressed: () => setState(() => _score = index + 1),
                  icon: Icon(
                    index < _score ? Icons.star : Icons.star_border,
                    color: widget.accent,
                    size: 28,
                  ),
                ),
              ),
            ),
            TextField(
              controller: _comment,
              style: const TextStyle(color: Colors.white),
              cursorColor: const Color(0xFFD4AF37),
              maxLines: 2,
              maxLength: 1000,
              decoration: _fieldDecoration('Komentar (opsional)').copyWith(
                counterText: '',
              ),
            ),
            const SizedBox(height: 10),
            FilledButton(
              onPressed: _submitting || _score == 0 ? null : _submit,
              style: FilledButton.styleFrom(
                backgroundColor: widget.accent,
                foregroundColor: Colors.black,
                minimumSize: const Size.fromHeight(46),
              ),
              child: const Text('Kirim Penilaian'),
            ),
          ],
        ),
      );
}

class _ErrorState extends StatelessWidget {
  const _ErrorState({
    required this.message,
    required this.onRetry,
    required this.accent,
  });
  final String message;
  final Future<void> Function() onRetry;
  final Color accent;
  @override
  Widget build(BuildContext context) => _CenteredContent(
        children: [
          const Icon(Icons.cloud_off_outlined, size: 62, color: Colors.white54),
          const Text(
            'Chat belum dapat dimuat',
            style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700),
          ),
          Text(
            message,
            textAlign: TextAlign.center,
            style: const TextStyle(color: Colors.white60),
          ),
          FilledButton(
            style: FilledButton.styleFrom(
              backgroundColor: accent,
              foregroundColor: Colors.black,
            ),
            onPressed: onRetry,
            child: const Text('Coba lagi'),
          ),
        ],
      );
}

class _UnavailableState extends StatelessWidget {
  const _UnavailableState({this.message});
  final String? message;

  @override
  Widget build(BuildContext context) => _CenteredContent(
        children: [
          const Icon(Icons.chat_bubble_outline,
              size: 62, color: Colors.white54),
          const Text(
            'Chat tidak tersedia',
            style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700),
          ),
          Text(
            message?.trim().isNotEmpty == true
                ? message!
                : 'Layanan chat sedang tidak tersedia.',
            textAlign: TextAlign.center,
            style: const TextStyle(color: Colors.white60),
          ),
        ],
      );
}

class _ErrorBanner extends StatelessWidget {
  const _ErrorBanner({required this.message, required this.onDismiss});
  final String message;
  final VoidCallback onDismiss;
  @override
  Widget build(BuildContext context) => Material(
        color: const Color(0xFF4A1919),
        child: ListTile(
          dense: true,
          leading: const Icon(Icons.error_outline, color: Colors.redAccent),
          title: Text(message, style: const TextStyle(fontSize: 12)),
          trailing: IconButton(
            onPressed: onDismiss,
            icon: const Icon(Icons.close, size: 18),
          ),
        ),
      );
}

class _EndedActions extends StatelessWidget {
  const _EndedActions({
    required this.accent,
    required this.onNewConversation,
  });
  final Color accent;
  final Future<void> Function() onNewConversation;
  @override
  Widget build(BuildContext context) => Material(
        color: const Color(0xFF2E2E2E),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: const Color(0xFF09090B),
              border: Border.all(color: const Color(0xFF27272A)),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Column(
              children: [
                const Text(
                  'Percakapan ini sudah diakhiri.',
                  style: TextStyle(fontSize: 14, color: Color(0xFFF4F4F5)),
                ),
                const SizedBox(height: 4),
                const Text(
                  'Pilih Pesan Baru untuk memulai percakapan baru.',
                  style: TextStyle(fontSize: 12, color: Color(0xFFA1A1AA)),
                ),
                const SizedBox(height: 12),
                FilledButton(
                  onPressed: () => _run(context, onNewConversation),
                  style: FilledButton.styleFrom(
                    backgroundColor: accent,
                    foregroundColor: const Color(0xFF111111),
                  ),
                  child: const Text('Pesan Baru'),
                ),
              ],
            ),
          ),
        ),
      );
}

class _CenteredContent extends StatelessWidget {
  const _CenteredContent({required this.children});
  final List<Widget> children;
  @override
  Widget build(BuildContext context) => Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(28),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              for (final child in children) ...[
                child,
                const SizedBox(height: 12)
              ],
            ],
          ),
        ),
      );
}

String _headerName(String? name) => name == 'Solid Gold — Website Utama'
    ? 'Customer Service SGB'
    : name ?? 'SolidChat';

InputDecoration _fieldDecoration(String hint) => InputDecoration(
      hintText: hint,
      hintStyle: const TextStyle(color: Color(0xFF71717A)),
      filled: true,
      fillColor: const Color(0xFF18181B),
      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(8),
        borderSide: const BorderSide(color: Color(0xFF3F3F46)),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(8),
        borderSide: const BorderSide(color: Color(0xFFD4AF37)),
      ),
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
    );

Color _parseColor(String? value) {
  final hex = (value ?? '#D4AF37').replaceAll('#', '');
  final parsed = int.tryParse(hex.length == 6 ? 'FF$hex' : hex, radix: 16);
  return parsed == null ? const Color(0xFFD4AF37) : Color(parsed);
}

String _formatTime(String raw) {
  final date = DateTime.tryParse(raw)?.toLocal();
  if (date == null) return '';
  final hour = date.hour.toString().padLeft(2, '0');
  final minute = date.minute.toString().padLeft(2, '0');
  return '$hour:$minute';
}

String? _required(String? value) =>
    value?.trim().isEmpty != false ? 'Wajib diisi' : null;
String? _emailValidator(String? value) =>
    RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(value?.trim() ?? '')
        ? null
        : 'Email tidak valid';
String? _phoneValidator(String? value) =>
    (value ?? '').replaceAll(RegExp(r'\D'), '').length >= 8
        ? null
        : 'Nomor telepon tidak valid';
String _mimeFromName(String name) {
  final lower = name.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}

Future<void> _run(
  BuildContext context,
  Future<void> Function() operation,
) async {
  try {
    await operation();
  } catch (error) {
    if (context.mounted) _showError(context, error);
  }
}

void _showError(BuildContext context, Object error) {
  final message =
      error is SolidChatException ? error.message : error.toString();
  ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
}
