import Foundation

public struct SolidChatConfiguration: Sendable {
    public let apiURL: URL
    public let siteId: String
    public let language: String

    public init(apiURL: URL, siteId: String, language: String = "id") {
        self.apiURL = apiURL
        self.siteId = siteId
        self.language = language
    }
}

public struct SolidChatSessionContext: Codable, Sendable {
    public var pageUrl: String?
    public var pageTitle: String?
    public var referrer: String?
    public var utm: UTM?
    public var device: Device?

    public init(pageUrl: String? = nil, pageTitle: String? = nil, referrer: String? = nil, utm: UTM? = nil, device: Device? = nil) {
        self.pageUrl = pageUrl; self.pageTitle = pageTitle; self.referrer = referrer; self.utm = utm; self.device = device
    }

    public struct UTM: Codable, Sendable {
        public var source: String?; public var medium: String?; public var campaign: String?
        public init(source: String? = nil, medium: String? = nil, campaign: String? = nil) { self.source = source; self.medium = medium; self.campaign = campaign }
    }
    public struct Device: Codable, Sendable {
        public var timezone: String?; public var screenWidth: Int?; public var screenHeight: Int?
        public init(timezone: String? = nil, screenWidth: Int? = nil, screenHeight: Int? = nil) { self.timezone = timezone; self.screenWidth = screenWidth; self.screenHeight = screenHeight }
    }
}

public struct SiteSettings: Codable, Sendable {
    public let widgetEnabled: Bool?
    public let aiEnabled: Bool?
    public let humanChatEnabled: Bool?
    public let preChatFormEnabled: Bool?
    public let showAgentButton: Bool?
    public let agentButtonLabel: String?
    public let allowAttachments: Bool?
    public let ratingFormEnabled: Bool?
    public let agentReplyTimeoutSeconds: Int?
}

public struct SiteConfiguration: Codable, Sendable {
    public let siteId: String
    public let name: String
    public let aiName: String?
    public let logoUrl: String?
    public let widgetColor: String?
    public let greeting: String?
    public let offlineMessage: String?
    public let language: String?
    public var presenceStatus: String?
    public let settings: SiteSettings?
}

public struct Conversation: Codable, Sendable {
    public let id: String
    public var status: String
    public var handlerType: String
    public let assignedAgentId: String?
}

public struct Attachment: Codable, Identifiable, Sendable {
    public let id: String
    public let fileName: String
    public let mimeType: String
}

public struct ChatMessage: Codable, Identifiable, Sendable {
    public let id: String
    public let conversationId: String
    public let senderType: String
    public let messageType: String
    public let content: String
    public let createdAt: String
    public let clientMessageId: String?
    public let senderName: String?
    public let attachments: [Attachment]?
}

public struct PreChatInput: Sendable {
    public let name: String; public let email: String; public let phone: String; public let message: String; public let consentGiven: Bool
    public init(name: String, email: String, phone: String, message: String, consentGiven: Bool) {
        self.name = name; self.email = email; self.phone = phone; self.message = message; self.consentGiven = consentGiven
    }
}

public struct TicketInput: Codable, Sendable {
    public let name: String; public let email: String; public let phone: String; public let subject: String; public let description: String; public let category: String?
    public init(name: String, email: String, phone: String, subject: String, description: String, category: String? = nil) {
        self.name = name; self.email = email; self.phone = phone; self.subject = subject; self.description = description; self.category = category
    }
}

public struct TicketResult: Codable, Sendable { public let id: String; public let ticketNumber: String }

public struct SolidChatState: Sendable {
    public var loading = false
    public var connected = false
    public var site: SiteConfiguration?
    public var conversation: Conversation?
    public var messages: [ChatMessage] = []
    public var agentTyping = false
    public var agentTypingName: String?
    public var aiTyping = false
    public var agentRequested = false
    public var leadSubmitted = false
    public var ticketNumber: String?
    public var error: SolidChatError?

    public var ended: Bool { conversation?.status == "RESOLVED" || conversation?.status == "CLOSED" }
    public var agentHandling: Bool { conversation?.handlerType == "HUMAN" }
    public var offline: Bool { site?.settings?.humanChatEnabled == false }
    public var canRequestAgent: Bool {
        site?.settings?.showAgentButton != false && !ended && !agentHandling && !agentRequested && messages.contains { $0.senderType == "AI" }
    }
}

public struct SolidChatError: Error, LocalizedError, Sendable {
    public let code: String
    public let message: String
    public let statusCode: Int?
    public var errorDescription: String? { message }
    public init(code: String, message: String, statusCode: Int? = nil) { self.code = code; self.message = message; self.statusCode = statusCode }
}

struct SessionRequest: Codable {
    let siteId: String; let visitorId: String; let pageUrl: String?; let pageTitle: String?; let language: String; let referrer: String?
    let utm: SolidChatSessionContext.UTM?; let device: SolidChatSessionContext.Device?
}
struct SessionResult: Codable { let visitorToken: String; let site: SiteConfiguration }
struct ConversationDetail: Codable { let conversation: Conversation; let messages: [ChatMessage] }
struct SendMessageRequest: Codable { let content: String; let clientMessageId: String; var messageType = "TEXT" }
struct LeadRequest: Codable { let name: String; let email: String; let phone: String; let consentGiven: Bool }
struct LeadResult: Codable { let id: String; let syncStatus: String; let conversationId: String? }
struct FeedbackRequest: Codable { let score: Int; let comment: String? }
struct IdentityRequest: Codable { let identityToken: String }
struct AgentTimeoutResult: Codable { let restored: Bool; let conversation: Conversation }
struct EmptyRequest: Codable {}
struct EmptyResponse: Codable {}
