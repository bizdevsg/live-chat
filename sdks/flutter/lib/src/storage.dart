import 'dart:math';

import 'package:shared_preferences/shared_preferences.dart';

class SolidChatStorage {
  SolidChatStorage._(this._preferences, this._prefix);

  final SharedPreferences _preferences;
  final String _prefix;

  static Future<SolidChatStorage> create(String siteId) async =>
      SolidChatStorage._(
        await SharedPreferences.getInstance(),
        'solidchat.$siteId.',
      );

  String get visitorId {
    final existing = _preferences.getString('${_prefix}visitorId');
    if (existing != null && existing.isNotEmpty) return existing;
    final created = _uuid();
    _preferences.setString('${_prefix}visitorId', created);
    return created;
  }

  String? get visitorToken => _preferences.getString('${_prefix}visitorToken');
  set visitorToken(String? value) =>
      _setNullable('${_prefix}visitorToken', value);

  String? get conversationId =>
      _preferences.getString('${_prefix}conversationId');
  set conversationId(String? value) =>
      _setNullable('${_prefix}conversationId', value);

  bool leadSubmitted(String conversationId) =>
      _preferences.getBool('${_prefix}lead.$conversationId') ?? false;
  Future<void> markLead(String conversationId) =>
      _preferences.setBool('${_prefix}lead.$conversationId', true);
  String? ticketNumber(String conversationId) =>
      _preferences.getString('${_prefix}ticket.$conversationId');
  Future<void> saveTicket(String conversationId, String number) =>
      _preferences.setString('${_prefix}ticket.$conversationId', number);

  Future<void> clearLead() async {
    final keys = _preferences.getKeys().where(
          (key) => key.startsWith('${_prefix}lead.'),
        );
    for (final key in keys) {
      await _preferences.remove(key);
    }
  }

  Future<void> clearTickets() async {
    final keys = _preferences.getKeys().where(
          (key) => key.startsWith('${_prefix}ticket.'),
        );
    for (final key in keys) {
      await _preferences.remove(key);
    }
  }

  Future<void> clearTicket(String conversationId) =>
      _preferences.remove('${_prefix}ticket.$conversationId');

  DateTime? agentRequestStartedAt(String conversationId) {
    final raw =
        _preferences.getString('${_prefix}agentRequest.$conversationId');
    return raw == null ? null : DateTime.tryParse(raw);
  }

  Future<void> saveAgentRequestStartedAt(
    String conversationId,
    DateTime startedAt,
  ) =>
      _preferences.setString(
        '${_prefix}agentRequest.$conversationId',
        startedAt.toUtc().toIso8601String(),
      );

  Future<void> clearAgentRequestStartedAt(String conversationId) =>
      _preferences.remove('${_prefix}agentRequest.$conversationId');

  Future<void> reset() async {
    final keys = _preferences.getKeys().where((key) => key.startsWith(_prefix));
    for (final key in keys) {
      await _preferences.remove(key);
    }
  }

  void _setNullable(String key, String? value) {
    if (value == null) {
      _preferences.remove(key);
    } else {
      _preferences.setString(key, value);
    }
  }
}

String solidChatUuid() => _uuid();

String _uuid() {
  final random = Random.secure();
  final bytes = List<int>.generate(16, (_) => random.nextInt(256));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  final hex =
      bytes.map((byte) => byte.toRadixString(16).padLeft(2, '0')).join();
  return '${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20)}';
}
