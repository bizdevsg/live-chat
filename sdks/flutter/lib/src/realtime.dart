import 'package:socket_io_client/socket_io_client.dart' as io;

import 'models.dart';

class SolidChatRealtimeCallbacks {
  const SolidChatRealtimeCallbacks({
    required this.onConnected,
    required this.onMessage,
    required this.onConversation,
    required this.onTyping,
    required this.onPresence,
    required this.onError,
  });

  final void Function(bool connected) onConnected;
  final void Function(ChatMessage message) onMessage;
  final void Function(String? status, String? handlerType) onConversation;
  final void Function(String from, bool typing, String? senderName) onTyping;
  final void Function(String status) onPresence;
  final void Function(SolidChatException error) onError;
}

class SolidChatRealtime {
  SolidChatRealtime(String apiUrl, this.callbacks)
      : _apiUrl = apiUrl.replaceFirst(RegExp(r'/+$'), '');

  final String _apiUrl;
  final SolidChatRealtimeCallbacks callbacks;
  io.Socket? _socket;
  String? _conversationId;

  void connect({required String visitorToken, required String conversationId}) {
    disconnect();
    _conversationId = conversationId;
    final socket = io.io(
      '$_apiUrl/widget',
      io.OptionBuilder()
          .setPath('/socket.io/')
          .setTransports(['websocket', 'polling'])
          .setAuth({'visitorToken': visitorToken})
          .enableReconnection()
          .disableAutoConnect()
          .build(),
    );
    _socket = socket;
    socket.onConnect((_) {
      callbacks.onConnected(true);
      socket.emit('widget:join', {'conversationId': conversationId});
    });
    socket.onDisconnect((_) => callbacks.onConnected(false));
    socket.onConnectError(
      (error) => callbacks.onError(
        SolidChatException(
          'SOCKET_CONNECTION_ERROR',
          error?.toString() ?? 'Realtime tidak terhubung.',
        ),
      ),
    );
    socket.on('message:created', (payload) {
      final map = _map(payload);
      if (map == null ||
          map['conversationId'] != _conversationId ||
          map['internalOnly'] == true) {
        return;
      }
      final message = _map(map['message']);
      if (message != null) {
        callbacks.onMessage(ChatMessage.fromJson(message));
      }
    });
    socket.on('conversation:updated', (payload) {
      final map = _map(payload);
      if (map == null || map['conversationId'] != _conversationId) {
        return;
      }
      callbacks.onConversation(
        map['status'] as String?,
        map['handlerType'] as String?,
      );
    });
    socket.on('typing:updated', (payload) {
      final map = _map(payload);
      if (map == null) {
        return;
      }
      callbacks.onTyping(
        map['from'] as String? ?? '',
        map['typing'] as bool? ?? false,
        map['senderName'] as String?,
      );
    });
    socket.on('site:presence', (payload) {
      final map = _map(payload);
      final status = map?['status'] as String?;
      if (status != null) {
        callbacks.onPresence(status);
      }
    });
    socket.on('error', (payload) {
      final map = _map(payload);
      callbacks.onError(
        SolidChatException(
          map?['code'] as String? ?? 'SOCKET_ERROR',
          map?['message'] as String? ?? 'Realtime error.',
        ),
      );
    });
    socket.connect();
  }

  void typing(bool typing) {
    final id = _conversationId;
    if (id != null) {
      _socket?.emit(typing ? 'typing:start' : 'typing:stop', {
        'conversationId': id,
      });
    }
  }

  void markRead(String messageId) {
    final id = _conversationId;
    if (id != null) {
      _socket?.emit('message:read', {
        'conversationId': id,
        'messageId': messageId,
      });
    }
  }

  void disconnect() {
    _socket?.disconnect();
    _socket?.dispose();
    _socket = null;
    _conversationId = null;
    callbacks.onConnected(false);
  }

  Map<String, dynamic>? _map(dynamic value) {
    if (value is Map<String, dynamic>) {
      return value;
    }
    if (value is Map) {
      return value.map((key, item) => MapEntry(key.toString(), item));
    }
    return null;
  }
}
