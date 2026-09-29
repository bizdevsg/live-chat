package com.solidchat.sdk

import io.socket.client.IO
import io.socket.client.Socket
import kotlinx.serialization.json.Json
import org.json.JSONObject

internal class SolidChatRealtime(
    apiUrl: String,
    private val json: Json,
    private val listener: Listener,
) {
    interface Listener {
        fun onConnected(connected: Boolean)
        fun onMessage(message: ChatMessage)
        fun onConversation(status: String?, handlerType: String?)
        fun onTyping(from: String, typing: Boolean, senderName: String?)
        fun onPresence(status: String)
        fun onError(error: SolidChatException)
    }

    private val socketUrl = apiUrl.trimEnd('/') + "/widget"
    private var socket: Socket? = null
    private var conversationId: String? = null

    fun connect(visitorToken: String, conversationId: String) {
        disconnect()
        this.conversationId = conversationId
        val options = IO.Options.builder()
            .setAuth(mapOf("visitorToken" to visitorToken))
            .setPath("/socket.io/")
            .setTransports(arrayOf("websocket", "polling"))
            .setReconnection(true)
            .build()
        socket = IO.socket(socketUrl, options).also { next ->
            next.on(Socket.EVENT_CONNECT) {
                listener.onConnected(true)
                next.emit("widget:join", JSONObject().put("conversationId", conversationId))
            }
            next.on(Socket.EVENT_DISCONNECT) { listener.onConnected(false) }
            next.on(Socket.EVENT_CONNECT_ERROR) { args ->
                listener.onError(SolidChatException("SOCKET_CONNECTION_ERROR", args.firstOrNull()?.toString() ?: "Realtime tidak terhubung."))
            }
            next.on("message:created") { args ->
                val payload = args.firstOrNull() as? JSONObject ?: return@on
                if (payload.optString("conversationId") != this.conversationId || payload.optBoolean("internalOnly")) return@on
                runCatching { json.decodeFromString<ChatMessage>(payload.getJSONObject("message").toString()) }.onSuccess(listener::onMessage)
            }
            next.on("conversation:updated") { args ->
                val payload = args.firstOrNull() as? JSONObject ?: return@on
                if (payload.optString("conversationId") != this.conversationId) return@on
                listener.onConversation(payload.optNullable("status"), payload.optNullable("handlerType"))
            }
            next.on("typing:updated") { args ->
                val payload = args.firstOrNull() as? JSONObject ?: return@on
                listener.onTyping(payload.optString("from"), payload.optBoolean("typing"), payload.optNullable("senderName"))
            }
            next.on("site:presence") { args ->
                val payload = args.firstOrNull() as? JSONObject ?: return@on
                listener.onPresence(payload.optString("status"))
            }
            next.on("error") { args ->
                val payload = args.firstOrNull() as? JSONObject
                listener.onError(SolidChatException(payload?.optString("code") ?: "SOCKET_ERROR", payload?.optString("message") ?: "Realtime error."))
            }
            next.connect()
        }
    }

    fun typing(typing: Boolean) {
        val id = conversationId ?: return
        socket?.emit(if (typing) "typing:start" else "typing:stop", JSONObject().put("conversationId", id))
    }

    fun markRead(messageId: String) {
        val id = conversationId ?: return
        socket?.emit("message:read", JSONObject().put("conversationId", id).put("messageId", messageId))
    }

    fun disconnect() {
        socket?.off()
        socket?.disconnect()
        socket = null
        conversationId = null
        listener.onConnected(false)
    }

    private fun JSONObject.optNullable(key: String): String? = if (has(key) && !isNull(key)) getString(key) else null
}
