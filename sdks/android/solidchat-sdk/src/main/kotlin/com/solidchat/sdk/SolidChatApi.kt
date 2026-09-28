package com.solidchat.sdk

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.asRequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.File

internal class SolidChatApi(
    apiUrl: String,
    @PublishedApi internal val client: OkHttpClient,
    @PublishedApi internal val json: Json,
) {
    @PublishedApi internal val baseUrl = apiUrl.trimEnd('/')
    var token: String? = null

    suspend inline fun <reified RequestBody, reified ResponseBody> post(path: String, body: RequestBody): ResponseBody =
        execute(path, "POST", json.encodeToString(body).toRequestBody(JSON))

    suspend inline fun <reified ResponseBody> postEmpty(path: String): ResponseBody =
        execute(path, "POST", "{}".toRequestBody(JSON))

    suspend inline fun <reified ResponseBody> get(path: String): ResponseBody = execute(path, "GET", null)

    suspend inline fun <reified RequestBody> postUnit(path: String, body: RequestBody) = withContext(Dispatchers.IO) {
        val request = Request.Builder().url("$baseUrl$path")
            .post(json.encodeToString(body).toRequestBody(JSON))
            .apply { token?.let { header("Authorization", "Bearer $it") }; header("Accept", "application/json") }
            .build()
        client.newCall(request).execute().use { response ->
            val raw = response.body?.string().orEmpty()
            val envelope = runCatching { json.decodeFromString<ApiEnvelope<kotlinx.serialization.json.JsonElement>>(raw) }.getOrNull()
            if (!response.isSuccessful || envelope?.success == false) {
                throw SolidChatException(envelope?.error?.code ?: "HTTP_${response.code}", envelope?.error?.message ?: "Terjadi kesalahan.", response.code)
            }
        }
    }

    suspend inline fun <reified ResponseBody> execute(path: String, method: String, body: okhttp3.RequestBody?): ResponseBody = withContext(Dispatchers.IO) {
        val request = Request.Builder().url("$baseUrl$path").method(method, body).apply {
            token?.let { header("Authorization", "Bearer $it") }
            header("Accept", "application/json")
        }.build()
        client.newCall(request).execute().use { response ->
            val raw = response.body?.string().orEmpty()
            val envelope = runCatching { json.decodeFromString<ApiEnvelope<ResponseBody>>(raw) }.getOrElse {
                throw SolidChatException("INVALID_RESPONSE", "Respons server tidak dapat dibaca.", response.code)
            }
            if (!response.isSuccessful || !envelope.success || envelope.data == null) {
                throw SolidChatException(envelope.error?.code ?: "HTTP_${response.code}", envelope.error?.message ?: "Terjadi kesalahan.", response.code)
            }
            envelope.data
        }
    }

    suspend fun uploadImage(conversationId: String, file: File, mimeType: String, caption: String, clientMessageId: String): ChatMessage = withContext(Dispatchers.IO) {
        val multipart = MultipartBody.Builder().setType(MultipartBody.FORM)
            .addFormDataPart("file", file.name, file.asRequestBody(mimeType.toMediaType()))
            .addFormDataPart("content", caption)
            .addFormDataPart("clientMessageId", clientMessageId)
            .build()
        execute("/api/v1/widget/conversations/$conversationId/images", "POST", multipart)
    }

    companion object { @PublishedApi internal val JSON = "application/json; charset=utf-8".toMediaType() }
}
