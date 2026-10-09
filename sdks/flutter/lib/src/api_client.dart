import 'dart:convert';
import 'dart:typed_data';

import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';

import 'models.dart';

class SolidChatApiClient {
  SolidChatApiClient(String apiUrl, {http.Client? httpClient})
      : baseUrl = apiUrl.replaceFirst(RegExp(r'/+$'), ''),
        _http = httpClient ?? http.Client();

  final String baseUrl;
  final http.Client _http;
  String? token;

  Future<Map<String, dynamic>> getMap(String path) async {
    final response = await _http.get(
      Uri.parse('$baseUrl$path'),
      headers: _headers(),
    );
    return _decodeMap(response);
  }

  Future<Map<String, dynamic>> postMap(
    String path, [
    Map<String, dynamic> body = const {},
  ]) async {
    final response = await _http.post(
      Uri.parse('$baseUrl$path'),
      headers: _headers(json: true),
      body: jsonEncode(body),
    );
    return _decodeMap(response);
  }

  Future<void> postUnit(
    String path, [
    Map<String, dynamic> body = const {},
  ]) async {
    final response = await _http.post(
      Uri.parse('$baseUrl$path'),
      headers: _headers(json: true),
      body: jsonEncode(body),
    );
    _decodeEnvelope(response, requireData: false);
  }

  Future<ChatMessage> uploadImage({
    required String conversationId,
    required Uint8List bytes,
    required String fileName,
    required String mimeType,
    String caption = '',
    required String clientMessageId,
  }) async {
    final request = http.MultipartRequest(
      'POST',
      Uri.parse(
        '$baseUrl/api/v1/widget/conversations/$conversationId/images',
      ),
    )
      ..headers.addAll(_headers())
      ..fields['content'] = caption
      ..fields['clientMessageId'] = clientMessageId
      ..files.add(
        http.MultipartFile.fromBytes(
          'file',
          bytes,
          filename: fileName,
          contentType: _mediaType(mimeType),
        ),
      );
    final streamed = await _http.send(request);
    final response = await http.Response.fromStream(streamed);
    return ChatMessage.fromJson(_decodeMap(response));
  }

  Map<String, String> _headers({bool json = false}) => {
        'Accept': 'application/json',
        if (json) 'Content-Type': 'application/json',
        if (token != null) 'Authorization': 'Bearer $token',
      };

  Map<String, dynamic> _decodeMap(http.Response response) {
    final data = _decodeEnvelope(response);
    if (data is! Map<String, dynamic>) {
      throw SolidChatException(
        'INVALID_RESPONSE',
        'Respons server tidak dapat dibaca.',
        httpStatus: response.statusCode,
      );
    }
    return data;
  }

  dynamic _decodeEnvelope(http.Response response, {bool requireData = true}) {
    Map<String, dynamic> envelope;
    try {
      envelope = jsonDecode(response.body) as Map<String, dynamic>;
    } catch (_) {
      throw SolidChatException(
        'INVALID_RESPONSE',
        'Respons server tidak dapat dibaca.',
        httpStatus: response.statusCode,
      );
    }
    final success = response.statusCode >= 200 &&
        response.statusCode < 300 &&
        envelope['success'] == true;
    final error = envelope['error'] as Map<String, dynamic>?;
    if (!success || (requireData && envelope['data'] == null)) {
      throw SolidChatException(
        error?['code'] as String? ?? 'HTTP_${response.statusCode}',
        error?['message'] as String? ?? 'Terjadi kesalahan.',
        httpStatus: response.statusCode,
      );
    }
    return envelope['data'];
  }

  MediaType _mediaType(String value) {
    final parts = value.split('/');
    return MediaType(parts.first, parts.length > 1 ? parts[1] : 'octet-stream');
  }

  void close() => _http.close();
}
