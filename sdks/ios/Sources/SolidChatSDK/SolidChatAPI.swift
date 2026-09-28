import Foundation

final class SolidChatAPI {
    private let baseURL: URL
    private let session: URLSession
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()
    var token: String?

    init(baseURL: URL, session: URLSession = .shared) { self.baseURL = baseURL; self.session = session }

    func get<Response: Decodable>(_ path: String, as: Response.Type = Response.self) async throws -> Response {
        try await request(path, method: "GET", body: Optional<EmptyRequest>.none)
    }

    func post<Body: Encodable, Response: Decodable>(_ path: String, body: Body, as: Response.Type = Response.self) async throws -> Response {
        try await request(path, method: "POST", body: body)
    }

    func postUnit<Body: Encodable>(_ path: String, body: Body) async throws {
        var request = try makeRequest(path, method: "POST")
        request.httpBody = try encoder.encode(body)
        let (data, response) = try await session.data(for: request)
        try validate(data: data, response: response, requireData: false)
    }

    func uploadImage(_ path: String, data: Data, fileName: String, mimeType: String, caption: String, clientMessageId: String) async throws -> ChatMessage {
        let boundary = "SolidChat-\(UUID().uuidString)"
        var request = try makeRequest(path, method: "POST")
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        var body = Data()
        func field(_ name: String, _ value: String) {
            body.append("--\(boundary)\r\nContent-Disposition: form-data; name=\"\(name)\"\r\n\r\n\(value)\r\n".data(using: .utf8)!)
        }
        field("content", caption); field("clientMessageId", clientMessageId)
        body.append("--\(boundary)\r\nContent-Disposition: form-data; name=\"file\"; filename=\"\(fileName)\"\r\nContent-Type: \(mimeType)\r\n\r\n".data(using: .utf8)!)
        body.append(data); body.append("\r\n--\(boundary)--\r\n".data(using: .utf8)!)
        request.httpBody = body
        let (responseData, response) = try await session.data(for: request)
        return try decodeEnvelope(responseData, response: response)
    }

    private func request<Body: Encodable, Response: Decodable>(_ path: String, method: String, body: Body?) async throws -> Response {
        var request = try makeRequest(path, method: method)
        if let body { request.httpBody = try encoder.encode(body) }
        let (data, response) = try await session.data(for: request)
        return try decodeEnvelope(data, response: response)
    }

    private func makeRequest(_ path: String, method: String) throws -> URLRequest {
        guard let url = URL(string: path, relativeTo: baseURL) else { throw SolidChatError(code: "INVALID_URL", message: "URL SolidChat tidak valid.") }
        var request = URLRequest(url: url); request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let token { request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
        return request
    }

    private struct Envelope<Value: Decodable>: Decodable { let success: Bool; let data: Value?; let error: ErrorBody? }
    private struct ErrorBody: Decodable { let code: String; let message: String }

    private func decodeEnvelope<Response: Decodable>(_ data: Data, response: URLResponse) throws -> Response {
        let status = (response as? HTTPURLResponse)?.statusCode
        guard let envelope = try? decoder.decode(Envelope<Response>.self, from: data) else { throw SolidChatError(code: "INVALID_RESPONSE", message: "Respons server tidak dapat dibaca.", statusCode: status) }
        guard envelope.success, let value = envelope.data, status.map({ 200..<300 ~= $0 }) != false else {
            throw SolidChatError(code: envelope.error?.code ?? "HTTP_\(status ?? 0)", message: envelope.error?.message ?? "Terjadi kesalahan.", statusCode: status)
        }
        return value
    }

    private func validate(data: Data, response: URLResponse, requireData: Bool) throws {
        let status = (response as? HTTPURLResponse)?.statusCode
        if status.map({ !(200..<300).contains($0) }) == true {
            let envelope = try? decoder.decode(Envelope<EmptyResponse>.self, from: data)
            throw SolidChatError(code: envelope?.error?.code ?? "HTTP_\(status ?? 0)", message: envelope?.error?.message ?? "Terjadi kesalahan.", statusCode: status)
        }
    }
}
