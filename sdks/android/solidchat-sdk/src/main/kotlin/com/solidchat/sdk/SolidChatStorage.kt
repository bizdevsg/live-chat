package com.solidchat.sdk

import android.content.Context
import java.util.UUID

internal class SolidChatStorage(context: Context, siteId: String) {
    private val prefs = context.getSharedPreferences("solidchat_sdk_$siteId", Context.MODE_PRIVATE)

    fun visitorId(): String = prefs.getString("visitor_id", null) ?: "visitor_${UUID.randomUUID()}".also {
        prefs.edit().putString("visitor_id", it).apply()
    }

    var visitorToken: String?
        get() = prefs.getString("visitor_token", null)
        set(value) = prefs.edit().apply { if (value == null) remove("visitor_token") else putString("visitor_token", value) }.apply()

    var conversationId: String?
        get() = prefs.getString("conversation_id", null)
        set(value) = prefs.edit().apply { if (value == null) remove("conversation_id") else putString("conversation_id", value) }.apply()

    fun isLeadSubmitted(id: String) = prefs.getString("lead_conversation_id", null) == id
    fun markLeadSubmitted(id: String) = prefs.edit().putString("lead_conversation_id", id).apply()
    fun clearLead() = prefs.edit().remove("lead_conversation_id").apply()

    fun ticketNumber(id: String): String? = if (prefs.getString("ticket_conversation_id", null) == id) prefs.getString("ticket_number", null) else null
    fun saveTicket(id: String, number: String) = prefs.edit().putString("ticket_conversation_id", id).putString("ticket_number", number).apply()
    fun clearTicket() = prefs.edit().remove("ticket_conversation_id").remove("ticket_number").apply()

    fun reset() = prefs.edit().clear().apply()
}
