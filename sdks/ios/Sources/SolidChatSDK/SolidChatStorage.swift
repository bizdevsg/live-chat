import Foundation

final class SolidChatStorage {
    private let suiteName: String
    private let defaults: UserDefaults
    init(siteId: String) { suiteName = "com.solidchat.sdk.\(siteId)"; defaults = UserDefaults(suiteName: suiteName) ?? .standard }

    var visitorId: String {
        if let value = defaults.string(forKey: "visitor_id") { return value }
        let value = "visitor_\(UUID().uuidString.lowercased())"
        defaults.set(value, forKey: "visitor_id"); return value
    }
    var conversationId: String? { get { defaults.string(forKey: "conversation_id") } set { defaults.set(newValue, forKey: "conversation_id") } }
    func leadSubmitted(_ id: String) -> Bool { defaults.string(forKey: "lead_conversation_id") == id }
    func markLead(_ id: String) { defaults.set(id, forKey: "lead_conversation_id") }
    func clearLead() { defaults.removeObject(forKey: "lead_conversation_id") }
    func ticketNumber(_ id: String) -> String? { defaults.string(forKey: "ticket_conversation_id") == id ? defaults.string(forKey: "ticket_number") : nil }
    func saveTicket(_ id: String, number: String) { defaults.set(id, forKey: "ticket_conversation_id"); defaults.set(number, forKey: "ticket_number") }
    func clearTicket() { defaults.removeObject(forKey: "ticket_conversation_id"); defaults.removeObject(forKey: "ticket_number") }
    func reset() { defaults.removePersistentDomain(forName: suiteName) }
}
