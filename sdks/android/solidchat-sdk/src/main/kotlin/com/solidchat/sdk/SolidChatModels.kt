package com.solidchat.sdk

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

const val SOLIDCHAT_PRODUCTION_API_URL = "https://live-chat.sg-berjangka.com"
const val SOLIDCHAT_SOLID_GOLD_SITE_ID = "solid-gold-main"

@Serializable
data class SolidChatConfig(
    val apiUrl: String = SOLIDCHAT_PRODUCTION_API_URL,
    val siteId: String = SOLIDCHAT_SOLID_GOLD_SITE_ID,
    val language: String = "id",
)

@Serializable
data class SolidChatDevice(
    val timezone: String? = null,
    val screenWidth: Int? = null,
    val screenHeight: Int? = null,
)

@Serializable
data class SolidChatUtm(val source: String? = null, val medium: String? = null, val campaign: String? = null)

@Serializable
data class SolidChatSessionContext(
    val pageUrl: String? = null,
    val pageTitle: String? = null,
    val referrer: String? = null,
    val utm: SolidChatUtm? = null,
    val device: SolidChatDevice? = null,
)

@Serializable
data class SiteSettings(
    val widgetEnabled: Boolean = true,
    val aiEnabled: Boolean = true,
    val humanChatEnabled: Boolean = true,
    val preChatFormEnabled: Boolean = true,
    val showAgentButton: Boolean = true,
    val agentButtonLabel: String = "Hubungi Agent",
    val allowAttachments: Boolean = false,
    val ratingFormEnabled: Boolean = true,
    val agentReplyTimeoutSeconds: Int = 60,
)

@Serializable
data class SiteConfig(
    val siteId: String,
    val name: String,
    val aiName: String = "AI Assistant",
    val logoUrl: String? = null,
    val widgetColor: String = "#D4AF37",
    val greeting: String = "",
    val offlineMessage: String = "",
    val language: String = "id",
    val presenceStatus: String = "OFFLINE",
    val settings: SiteSettings? = null,
)

@Serializable
internal data class SessionRequest(
    val siteId: String,
    val visitorId: String,
    val pageUrl: String? = null,
    val pageTitle: String? = null,
    val language: String,
    val referrer: String? = null,
    val utm: SolidChatUtm? = null,
    val device: SolidChatDevice? = null,
)

@Serializable
internal data class SessionResult(val visitorToken: String, val site: SiteConfig)

@Serializable
data class Conversation(
    val id: String,
    val status: String,
    val handlerType: String,
    val assignedAgentId: String? = null,
)

@Serializable
data class Attachment(val id: String, val fileName: String, val mimeType: String)

@Serializable
internal data class AttachmentUrlResult(val url: String)

@Serializable
data class ChatMessage(
    val id: String,
    val conversationId: String,
    val senderType: String,
    val messageType: String,
    val content: String,
    val createdAt: String,
    val clientMessageId: String? = null,
    val senderName: String? = null,
    val attachments: List<Attachment> = emptyList(),
)

@Serializable
internal data class ConversationDetail(val conversation: Conversation, val messages: List<ChatMessage>)

@Serializable
data class PreChatInput(
    val name: String,
    val email: String,
    val phone: String,
    val message: String,
    val consentGiven: Boolean,
)

@Serializable
internal data class LeadRequest(
    val name: String,
    val email: String,
    val phone: String,
    val consentGiven: Boolean,
)

@Serializable
internal data class LeadResult(val id: String, val syncStatus: String, val conversationId: String? = null)

@Serializable
data class TicketInput(
    val name: String,
    val email: String,
    val phone: String,
    val subject: String,
    val description: String,
    val category: String? = null,
)

@Serializable
data class TicketResult(val id: String, val ticketNumber: String)

@Serializable
internal data class SendMessageRequest(val content: String, val clientMessageId: String, val messageType: String = "TEXT")

@Serializable
internal data class FeedbackRequest(val score: Int, val comment: String? = null)

@Serializable
internal data class IdentityRequest(val identityToken: String)

@Serializable
internal data class AgentTimeoutResult(val restored: Boolean, val conversation: Conversation)

@Serializable
internal data class ApiEnvelope<T>(val success: Boolean, val data: T? = null, val error: ApiErrorBody? = null)

@Serializable
internal data class ApiErrorBody(val code: String = "UNKNOWN_ERROR", val message: String = "Terjadi kesalahan.")

class SolidChatException(val code: String, override val message: String, val httpStatus: Int? = null) : Exception(message)

data class SolidChatState(
    val loading: Boolean = false,
    val connected: Boolean = false,
    val site: SiteConfig? = null,
    val conversation: Conversation? = null,
    val messages: List<ChatMessage> = emptyList(),
    val agentTyping: Boolean = false,
    val agentTypingName: String? = null,
    val aiTyping: Boolean = false,
    val agentRequested: Boolean = false,
    val leadSubmitted: Boolean = false,
    val ticketNumber: String? = null,
    val error: SolidChatException? = null,
) {
    val ended: Boolean get() = conversation?.status == "RESOLVED" || conversation?.status == "CLOSED"
    val agentHandling: Boolean get() = conversation?.handlerType == "HUMAN"
    val offline: Boolean get() = site?.settings?.humanChatEnabled == false
    val canRequestAgent: Boolean
        get() = site?.settings?.showAgentButton != false && !ended && !agentHandling && !agentRequested && messages.any { it.senderType == "AI" }
}
