package com.solidchat.sdk

import android.content.Context
import android.content.res.Resources
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.serialization.json.Json
import okhttp3.OkHttpClient
import java.io.File
import java.time.Instant
import java.util.TimeZone
import java.util.UUID
import java.util.concurrent.TimeUnit

class SolidChatClient(
    context: Context,
    val config: SolidChatConfig,
    httpClient: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .build(),
) : SolidChatRealtime.Listener {
    private val appContext = context.applicationContext
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private val json = Json { ignoreUnknownKeys = true; explicitNulls = false }
    private val storage = SolidChatStorage(appContext, config.siteId)
    private val api = SolidChatApi(config.apiUrl, httpClient, json)
    private val realtime = SolidChatRealtime(config.apiUrl, json, this)
    private var visitorToken: String? = null
    private var timeoutJob: Job? = null
    private var lastContext = SolidChatSessionContext()

    private val mutableState = MutableStateFlow(SolidChatState())
    val state: StateFlow<SolidChatState> = mutableState.asStateFlow()

    fun initialize(context: SolidChatSessionContext = defaultContext()) {
        lastContext = context
        scope.launch {
            mutableState.value = mutableState.value.copy(loading = true, error = null)
            runCatching {
                val session = api.post<SessionRequest, SessionResult>(
                    "/api/v1/widget/session",
                    SessionRequest(
                        siteId = config.siteId,
                        visitorId = storage.visitorId(),
                        pageUrl = context.pageUrl,
                        pageTitle = context.pageTitle,
                        language = config.language,
                        referrer = context.referrer,
                        utm = context.utm,
                        device = context.device,
                    ),
                )
                visitorToken = session.visitorToken
                api.token = session.visitorToken
                mutableState.value = mutableState.value.copy(site = session.site)
                restoreOrCreateConversation()
            }.onFailure(::publishError)
            mutableState.value = mutableState.value.copy(loading = false)
        }
    }

    suspend fun sendMessage(content: String) {
        val trimmed = content.trim()
        require(trimmed.isNotEmpty() && trimmed.length <= 4000) { "Pesan harus berisi 1-4000 karakter." }
        val conversation = requireConversation()
        val clientId = UUID.randomUUID().toString()
        val optimistic = ChatMessage(clientId, conversation.id, "VISITOR", "TEXT", trimmed, Instant.now().toString(), clientId)
        mergeMessage(optimistic)
        runCatching {
            api.post<SendMessageRequest, ChatMessage>(
                "/api/v1/widget/conversations/${conversation.id}/messages",
                SendMessageRequest(trimmed, clientId),
            )
        }.onSuccess(::mergeMessage).onFailure(::publishError).getOrThrow()
    }

    suspend fun uploadImage(file: File, mimeType: String, caption: String = "") {
        val conversation = requireConversation()
        check(conversation.handlerType == "HUMAN") { "Gambar hanya dapat dikirim saat ditangani agent." }
        runCatching { api.uploadImage(conversation.id, file, mimeType, caption, UUID.randomUUID().toString()) }
            .onSuccess(::mergeMessage).onFailure(::publishError).getOrThrow()
    }

    suspend fun submitPreChat(input: PreChatInput) {
        val conversation = requireConversation()
        val result = api.post<LeadRequest, LeadResult>(
            "/api/v1/widget/conversations/${conversation.id}/lead",
            LeadRequest(input.name.trim(), input.email.trim(), input.phone.trim(), input.consentGiven),
        )
        val targetId = result.conversationId ?: conversation.id
        storage.markLeadSubmitted(targetId)
        if (input.message.isNotBlank()) {
            api.post<SendMessageRequest, ChatMessage>(
                "/api/v1/widget/conversations/$targetId/messages",
                SendMessageRequest(input.message.trim(), UUID.randomUUID().toString()),
            )
        }
        loadConversation(targetId)
    }

    suspend fun submitTicket(input: TicketInput): TicketResult {
        val conversation = requireConversation()
        val result = api.post<TicketInput, TicketResult>("/api/v1/widget/conversations/${conversation.id}/ticket", input)
        storage.saveTicket(conversation.id, result.ticketNumber)
        mutableState.value = mutableState.value.copy(ticketNumber = result.ticketNumber)
        return result
    }

    suspend fun requestAgent() {
        val conversation = requireConversation()
        mutableState.value = mutableState.value.copy(agentRequested = true)
        runCatching {
            api.postEmpty<Conversation>("/api/v1/widget/conversations/${conversation.id}/request-agent")
        }.onSuccess { updated ->
            updateConversation(updated)
            if (updated.handlerType == "AI") mutableState.value = mutableState.value.copy(agentRequested = false)
            else scheduleAgentTimeout(updated.id)
        }.onFailure {
            mutableState.value = mutableState.value.copy(agentRequested = false)
            publishError(it)
        }.getOrThrow()
    }

    suspend fun closeConversation() {
        val conversation = requireConversation()
        updateConversation(api.postEmpty("/api/v1/widget/conversations/${conversation.id}/close"))
    }

    suspend fun startNewConversation() {
        timeoutJob?.cancel()
        realtime.disconnect()
        storage.conversationId = null
        storage.clearLead()
        storage.clearTicket()
        mutableState.value = mutableState.value.copy(conversation = null, messages = emptyList(), leadSubmitted = false, ticketNumber = null, agentRequested = false)
        val conversation = api.postEmpty<Conversation>("/api/v1/widget/conversations")
        setConversation(conversation, emptyList())
    }

    suspend fun submitFeedback(score: Int, comment: String? = null) {
        require(score in 1..5) { "Rating harus antara 1 dan 5." }
        val conversation = requireConversation()
        api.postUnit(
            "/api/v1/widget/conversations/${conversation.id}/feedback",
            FeedbackRequest(score, comment),
        )
    }

    suspend fun identify(identityToken: String) {
        api.post<IdentityRequest, kotlinx.serialization.json.JsonElement>("/api/v1/widget/identify", IdentityRequest(identityToken))
    }

    fun notifyTyping(typing: Boolean) = realtime.typing(typing)
    fun markRead(messageId: String) = realtime.markRead(messageId)
    fun clearTicketNotice() { storage.clearTicket(); mutableState.value = mutableState.value.copy(ticketNumber = null) }

    fun reset() {
        timeoutJob?.cancel()
        realtime.disconnect()
        storage.reset()
        visitorToken = null
        api.token = null
        mutableState.value = SolidChatState()
    }

    fun close() {
        timeoutJob?.cancel()
        realtime.disconnect()
        scope.coroutineContext[Job]?.cancel()
    }

    private suspend fun restoreOrCreateConversation() {
        val existingId = storage.conversationId
        if (existingId != null) {
            runCatching { loadConversation(existingId) }.onSuccess { return }
            storage.conversationId = null
        }
        val conversation = api.post<SessionRequest, Conversation>(
            "/api/v1/widget/conversations",
            SessionRequest(config.siteId, storage.visitorId(), lastContext.pageUrl, lastContext.pageTitle, config.language, lastContext.referrer, lastContext.utm, lastContext.device),
        )
        setConversation(conversation, emptyList())
    }

    private suspend fun loadConversation(id: String) {
        val detail = api.get<ConversationDetail>("/api/v1/widget/conversations/$id")
        setConversation(detail.conversation, detail.messages)
    }

    private fun setConversation(conversation: Conversation, messages: List<ChatMessage>) {
        storage.conversationId = conversation.id
        mutableState.value = mutableState.value.copy(
            conversation = conversation,
            messages = messages,
            leadSubmitted = storage.isLeadSubmitted(conversation.id),
            ticketNumber = storage.ticketNumber(conversation.id),
            agentRequested = conversation.status == "QUEUED" || conversation.status == "WAITING_AGENT",
        )
        realtime.connect(requireNotNull(visitorToken), conversation.id)
    }

    private fun mergeMessage(message: ChatMessage) {
        val current = mutableState.value.messages
        val index = current.indexOfFirst { it.id == message.id || (message.clientMessageId != null && it.clientMessageId == message.clientMessageId) }
        val next = if (index < 0) current + message else current.toMutableList().also { it[index] = message }
        mutableState.value = mutableState.value.copy(messages = next, aiTyping = if (message.senderType == "AI") false else mutableState.value.aiTyping,
            agentRequested = if (message.senderType == "AGENT" || message.senderType == "AI") false else mutableState.value.agentRequested)
    }

    private fun updateConversation(conversation: Conversation) {
        mutableState.value = mutableState.value.copy(conversation = conversation)
    }

    private fun scheduleAgentTimeout(conversationId: String) {
        timeoutJob?.cancel()
        val seconds = (mutableState.value.site?.settings?.agentReplyTimeoutSeconds ?: 60).coerceAtLeast(10)
        timeoutJob = scope.launch {
            delay(seconds * 1000L)
            repeat(5) { attempt ->
                val result = runCatching { api.postEmpty<AgentTimeoutResult>("/api/v1/widget/conversations/$conversationId/agent-timeout") }.getOrNull()
                if (result != null) {
                    updateConversation(result.conversation)
                    if (result.restored || result.conversation.handlerType == "AI") {
                        mutableState.value = mutableState.value.copy(agentRequested = false)
                        loadConversation(conversationId)
                        return@launch
                    }
                }
                if (attempt < 4) delay(3_000)
            }
        }
    }

    private fun requireConversation() = checkNotNull(mutableState.value.conversation) { "Conversation belum siap." }
    private fun publishError(error: Throwable) {
        val sdkError = error as? SolidChatException ?: SolidChatException("CLIENT_ERROR", error.message ?: "Terjadi kesalahan.")
        mutableState.value = mutableState.value.copy(error = sdkError)
    }

    override fun onConnected(connected: Boolean) { scope.launch { mutableState.value = mutableState.value.copy(connected = connected) } }
    override fun onMessage(message: ChatMessage) { scope.launch { mergeMessage(message) } }
    override fun onConversation(status: String?, handlerType: String?) { scope.launch {
        val current = mutableState.value.conversation ?: return@launch
        val updated = current.copy(status = status ?: current.status, handlerType = handlerType ?: current.handlerType)
        updateConversation(updated)
        if (updated.handlerType == "AI" || updated.handlerType == "HUMAN") mutableState.value = mutableState.value.copy(agentRequested = false)
    } }
    override fun onTyping(from: String, typing: Boolean, senderName: String?) { scope.launch {
        mutableState.value = when (from) {
            "AGENT" -> mutableState.value.copy(agentTyping = typing, agentTypingName = if (typing) senderName else null)
            "AI" -> mutableState.value.copy(aiTyping = typing)
            else -> mutableState.value
        }
    } }
    override fun onPresence(status: String) { scope.launch {
        mutableState.value.site?.let { mutableState.value = mutableState.value.copy(site = it.copy(presenceStatus = status)) }
    } }
    override fun onError(error: SolidChatException) { scope.launch { publishError(error) } }

    private fun defaultContext(): SolidChatSessionContext {
        val metrics = Resources.getSystem().displayMetrics
        return SolidChatSessionContext(device = SolidChatDevice(TimeZone.getDefault().id, metrics.widthPixels, metrics.heightPixels))
    }
}
