import Foundation
import SocketIO

@MainActor
public final class SolidChatClient: ObservableObject {
    @Published public private(set) var state = SolidChatState()

    public let configuration: SolidChatConfiguration
    private let api: SolidChatAPI
    private let storage: SolidChatStorage
    private var visitorToken: String?
    private var socketManager: SocketManager?
    private var socket: SocketIOClient?
    private var timeoutTask: Task<Void, Never>?
    private var sessionContext = SolidChatSessionContext()

    public init(configuration: SolidChatConfiguration, urlSession: URLSession = .shared) {
        self.configuration = configuration
        api = SolidChatAPI(baseURL: configuration.apiURL, session: urlSession)
        storage = SolidChatStorage(siteId: configuration.siteId)
    }

    public func initialize(context: SolidChatSessionContext = .init()) async {
        sessionContext = context
        state.loading = true; state.error = nil
        do {
            let request = SessionRequest(siteId: configuration.siteId, visitorId: storage.visitorId, pageUrl: context.pageUrl, pageTitle: context.pageTitle,
                language: configuration.language, referrer: context.referrer, utm: context.utm,
                device: context.device ?? .init(timezone: TimeZone.current.identifier))
            let session: SessionResult = try await api.post("/api/v1/widget/session", body: request)
            visitorToken = session.visitorToken; api.token = session.visitorToken; state.site = session.site
            try await restoreOrCreateConversation()
        } catch { publish(error) }
        state.loading = false
    }

    public func sendMessage(_ content: String) async throws {
        let text = content.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty, text.count <= 4000 else { throw SolidChatError(code: "VALIDATION_ERROR", message: "Pesan harus berisi 1-4000 karakter.") }
        let conversation = try requireConversation(); let clientId = UUID().uuidString.lowercased()
        merge(ChatMessage(id: clientId, conversationId: conversation.id, senderType: "VISITOR", messageType: "TEXT", content: text,
            createdAt: ISO8601DateFormatter().string(from: Date()), clientMessageId: clientId, senderName: nil, attachments: nil))
        do {
            let message: ChatMessage = try await api.post("/api/v1/widget/conversations/\(conversation.id)/messages", body: SendMessageRequest(content: text, clientMessageId: clientId))
            merge(message)
        } catch { publish(error); throw error }
    }

    public func uploadImage(data: Data, fileName: String, mimeType: String, caption: String = "") async throws {
        let conversation = try requireConversation()
        guard conversation.handlerType == "HUMAN" else { throw SolidChatError(code: "VALIDATION_ERROR", message: "Gambar hanya dapat dikirim saat ditangani agent.") }
        let message = try await api.uploadImage("/api/v1/widget/conversations/\(conversation.id)/images", data: data, fileName: fileName, mimeType: mimeType, caption: caption, clientMessageId: UUID().uuidString.lowercased())
        merge(message)
    }

    public func submitPreChat(_ input: PreChatInput) async throws {
        let conversation = try requireConversation()
        let lead: LeadResult = try await api.post("/api/v1/widget/conversations/\(conversation.id)/lead",
            body: LeadRequest(name: input.name.trimmingCharacters(in: .whitespaces), email: input.email.trimmingCharacters(in: .whitespaces), phone: input.phone.trimmingCharacters(in: .whitespaces), consentGiven: input.consentGiven))
        let id = lead.conversationId ?? conversation.id; storage.markLead(id)
        if !input.message.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            let _: ChatMessage = try await api.post("/api/v1/widget/conversations/\(id)/messages",
                body: SendMessageRequest(content: input.message, clientMessageId: UUID().uuidString.lowercased()))
        }
        try await loadConversation(id)
    }

    @discardableResult
    public func submitTicket(_ input: TicketInput) async throws -> TicketResult {
        let conversation = try requireConversation()
        let result: TicketResult = try await api.post("/api/v1/widget/conversations/\(conversation.id)/ticket", body: input)
        storage.saveTicket(conversation.id, number: result.ticketNumber); state.ticketNumber = result.ticketNumber
        return result
    }

    public func requestAgent() async throws {
        let conversation = try requireConversation(); state.agentRequested = true
        do {
            let updated: Conversation = try await api.post("/api/v1/widget/conversations/\(conversation.id)/request-agent", body: EmptyRequest())
            state.conversation = updated
            if updated.handlerType == "AI" { state.agentRequested = false } else { scheduleAgentTimeout(updated.id) }
        } catch { state.agentRequested = false; publish(error); throw error }
    }

    public func closeConversation() async throws {
        let conversation = try requireConversation()
        let updated: Conversation = try await api.post("/api/v1/widget/conversations/\(conversation.id)/close", body: EmptyRequest())
        state.conversation = updated
    }

    public func startNewConversation() async throws {
        timeoutTask?.cancel(); disconnectSocket(); storage.conversationId = nil; storage.clearLead(); storage.clearTicket()
        state.conversation = nil; state.messages = []; state.leadSubmitted = false; state.ticketNumber = nil; state.agentRequested = false
        let conversation: Conversation = try await api.post("/api/v1/widget/conversations", body: EmptyRequest())
        setConversation(conversation, messages: [])
    }

    public func submitFeedback(score: Int, comment: String? = nil) async throws {
        guard 1...5 ~= score else { throw SolidChatError(code: "VALIDATION_ERROR", message: "Rating harus antara 1 dan 5.") }
        let conversation = try requireConversation()
        try await api.postUnit("/api/v1/widget/conversations/\(conversation.id)/feedback", body: FeedbackRequest(score: score, comment: comment))
    }

    public func identify(identityToken: String) async throws {
        try await api.postUnit("/api/v1/widget/identify", body: IdentityRequest(identityToken: identityToken))
    }

    public func notifyTyping(_ typing: Bool) { guard let id = state.conversation?.id else { return }; socket?.emit(typing ? "typing:start" : "typing:stop", ["conversationId": id]) }
    public func markRead(_ messageId: String) { guard let id = state.conversation?.id else { return }; socket?.emit("message:read", ["conversationId": id, "messageId": messageId]) }
    public func clearTicketNotice() { storage.clearTicket(); state.ticketNumber = nil }

    public func reset() {
        timeoutTask?.cancel(); disconnectSocket(); storage.reset(); visitorToken = nil; api.token = nil; state = SolidChatState()
    }

    private func restoreOrCreateConversation() async throws {
        if let id = storage.conversationId {
            do { try await loadConversation(id); return } catch { storage.conversationId = nil }
        }
        let conversation: Conversation = try await api.post("/api/v1/widget/conversations", body: EmptyRequest())
        setConversation(conversation, messages: [])
    }

    private func loadConversation(_ id: String) async throws {
        let detail: ConversationDetail = try await api.get("/api/v1/widget/conversations/\(id)")
        setConversation(detail.conversation, messages: detail.messages)
    }

    private func setConversation(_ conversation: Conversation, messages: [ChatMessage]) {
        storage.conversationId = conversation.id; state.conversation = conversation; state.messages = messages
        state.leadSubmitted = storage.leadSubmitted(conversation.id); state.ticketNumber = storage.ticketNumber(conversation.id)
        state.agentRequested = conversation.status == "QUEUED" || conversation.status == "WAITING_AGENT"
        connectSocket(conversationId: conversation.id)
    }

    private func connectSocket(conversationId: String) {
        guard let token = visitorToken else { return }; disconnectSocket()
        let manager = SocketManager(socketURL: configuration.apiURL, config: [.log(false), .compress, .reconnects(true), .forceWebsockets(false)])
        let socket = manager.socket(forNamespace: "/widget")
        socket.on(clientEvent: .connect) { [weak self, weak socket] _, _ in
            guard let self else { return }; self.state.connected = true; socket?.emit("widget:join", ["conversationId": conversationId])
        }
        socket.on(clientEvent: .disconnect) { [weak self] _, _ in self?.state.connected = false }
        socket.on("message:created") { [weak self] values, _ in
            guard let self, let payload = values.first as? [String: Any], payload["conversationId"] as? String == conversationId,
                  payload["internalOnly"] as? Bool != true, let raw = payload["message"], let message: ChatMessage = self.decode(raw) else { return }
            self.merge(message)
        }
        socket.on("conversation:updated") { [weak self] values, _ in
            guard let self, let payload = values.first as? [String: Any], payload["conversationId"] as? String == conversationId, var current = self.state.conversation else { return }
            if let status = payload["status"] as? String { current.status = status }; if let handler = payload["handlerType"] as? String { current.handlerType = handler }
            self.state.conversation = current
            if current.handlerType == "AI" || current.handlerType == "HUMAN" { self.state.agentRequested = false }
        }
        socket.on("typing:updated") { [weak self] values, _ in
            guard let self, let payload = values.first as? [String: Any], let from = payload["from"] as? String, let typing = payload["typing"] as? Bool else { return }
            if from == "AGENT" { self.state.agentTyping = typing; self.state.agentTypingName = typing ? payload["senderName"] as? String : nil }
            if from == "AI" { self.state.aiTyping = typing }
        }
        socket.on("site:presence") { [weak self] values, _ in
            guard let self, let payload = values.first as? [String: Any], let status = payload["status"] as? String, var site = self.state.site else { return }
            site.presenceStatus = status; self.state.site = site
        }
        socket.on("error") { [weak self] values, _ in
            let payload = values.first as? [String: Any]
            self?.publish(SolidChatError(code: payload?["code"] as? String ?? "SOCKET_ERROR", message: payload?["message"] as? String ?? "Realtime error."))
        }
        socketManager = manager; self.socket = socket; socket.connect(withPayload: ["visitorToken": token])
    }

    private func disconnectSocket() { socket?.removeAllHandlers(); socket?.disconnect(); socket = nil; socketManager = nil; state.connected = false }

    private func scheduleAgentTimeout(_ id: String) {
        timeoutTask?.cancel(); let seconds = max(10, state.site?.settings?.agentReplyTimeoutSeconds ?? 60)
        timeoutTask = Task { [weak self] in
            try? await Task.sleep(for: .seconds(seconds))
            for attempt in 0..<5 {
                guard let self, !Task.isCancelled else { return }
                if let result: AgentTimeoutResult = try? await self.api.post("/api/v1/widget/conversations/\(id)/agent-timeout", body: EmptyRequest()) {
                    self.state.conversation = result.conversation
                    if result.restored || result.conversation.handlerType == "AI" { self.state.agentRequested = false; try? await self.loadConversation(id); return }
                }
                if attempt < 4 { try? await Task.sleep(for: .seconds(3)) }
            }
        }
    }

    private func merge(_ message: ChatMessage) {
        if let index = state.messages.firstIndex(where: { $0.id == message.id || (message.clientMessageId != nil && $0.clientMessageId == message.clientMessageId) }) { state.messages[index] = message }
        else { state.messages.append(message) }
        if message.senderType == "AI" { state.aiTyping = false; state.agentRequested = false }
        if message.senderType == "AGENT" { state.agentRequested = false }
    }

    private func requireConversation() throws -> Conversation {
        guard let conversation = state.conversation else { throw SolidChatError(code: "NOT_READY", message: "Conversation belum siap.") }
        return conversation
    }
    private func publish(_ error: Error) { state.error = error as? SolidChatError ?? SolidChatError(code: "CLIENT_ERROR", message: error.localizedDescription) }
    private func decode<Value: Decodable>(_ object: Any) -> Value? { guard JSONSerialization.isValidJSONObject(object), let data = try? JSONSerialization.data(withJSONObject: object) else { return nil }; return try? JSONDecoder().decode(Value.self, from: data) }
}
