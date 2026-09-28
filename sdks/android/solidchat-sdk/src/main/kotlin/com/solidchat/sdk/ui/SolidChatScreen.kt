package com.solidchat.sdk.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.solidchat.sdk.ChatMessage
import com.solidchat.sdk.PreChatInput
import com.solidchat.sdk.SolidChatClient
import com.solidchat.sdk.SolidChatSessionContext
import com.solidchat.sdk.SolidChatState
import com.solidchat.sdk.TicketInput
import kotlinx.coroutines.launch
import java.io.File

data class SelectedImage(val file: File, val mimeType: String, val caption: String = "")

@Composable
fun SolidChatScreen(
    client: SolidChatClient,
    modifier: Modifier = Modifier,
    sessionContext: SolidChatSessionContext = SolidChatSessionContext(),
    onRequestImage: (suspend () -> SelectedImage?)? = null,
    onClose: (() -> Unit)? = null,
) {
    val state by client.state.collectAsStateWithLifecycle()
    val scope = rememberCoroutineScope()
    var ratingVisible by remember { mutableStateOf(false) }

    LaunchedEffect(client) { client.initialize(sessionContext) }
    LaunchedEffect(state.ended, state.site?.settings?.ratingFormEnabled) {
        if (state.ended && state.site?.settings?.ratingFormEnabled == true) ratingVisible = true
    }

    val accent = remember(state.site?.widgetColor) { parseColor(state.site?.widgetColor) }
    Column(modifier.fillMaxSize().background(Color(0xFF09090B))) {
        Header(state, accent, onClose, onEnd = { scope.launch { client.closeConversation() } }, onNew = { scope.launch { client.startNewConversation() } })
        when {
            state.loading -> CenterMessage { CircularProgressIndicator(color = accent) }
            state.error != null && state.site == null -> CenterMessage { Text(state.error?.message.orEmpty(), color = Color(0xFFF87171)) }
            state.site?.settings?.widgetEnabled == false -> CenterMessage { Text(state.site?.offlineMessage.orEmpty(), color = Color.LightGray) }
            state.conversation == null -> CenterMessage { Text("Menyiapkan percakapan...", color = Color.Gray) }
            state.offline -> TicketForm(state, accent, onSubmit = { scope.launch { client.submitTicket(it) } }, onReset = client::clearTicketNotice)
            !state.leadSubmitted -> PreChatForm(accent) { scope.launch { client.submitPreChat(it) } }
            else -> ChatContent(state, accent, client, onRequestImage)
        }
    }

    if (ratingVisible) RatingDialog(accent, onDismiss = { ratingVisible = false }) { score, comment ->
        scope.launch { client.submitFeedback(score, comment); ratingVisible = false }
    }
}

@Composable
private fun Header(state: SolidChatState, accent: Color, onClose: (() -> Unit)?, onEnd: () -> Unit, onNew: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().background(Color(0xFF18181B)).padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Column(Modifier.weight(1f)) {
            Text(state.site?.name ?: "SolidChat", color = Color.White, style = MaterialTheme.typography.titleMedium)
            Text(if (state.connected) "Terhubung" else "Menghubungkan...", color = if (state.connected) accent else Color.Gray, style = MaterialTheme.typography.labelSmall)
        }
        if (state.ended) TextButton(onClick = onNew) { Text("Pesan Baru", color = accent) }
        else if (state.conversation != null) TextButton(onClick = onEnd) { Text("Akhiri", color = Color.LightGray) }
        if (onClose != null) TextButton(onClick = onClose) { Text("Tutup", color = Color.LightGray) }
    }
}

@Composable
private fun ChatContent(state: SolidChatState, accent: Color, client: SolidChatClient, onRequestImage: (suspend () -> SelectedImage?)?) {
    val scope = rememberCoroutineScope()
    val listState = rememberLazyListState()
    var text by remember { mutableStateOf("") }
    LaunchedEffect(state.messages.size) { if (state.messages.isNotEmpty()) listState.animateScrollToItem(state.messages.lastIndex) }

    Column(Modifier.fillMaxSize()) {
        LazyColumn(
            Modifier.weight(1f).fillMaxWidth().padding(horizontal = 12.dp),
            state = listState,
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            item { Spacer(Modifier.height(4.dp)) }
            items(state.messages, key = { it.id }) { MessageBubble(it, accent) }
            if (state.agentRequested) item { Notice("Sedang menghubungkan Anda dengan agent...") }
            if (state.agentTyping || state.aiTyping) item { Notice(if (state.agentTyping) "${state.agentTypingName ?: "Agent"} sedang mengetik..." else "${state.site?.aiName ?: "AI"} sedang mengetik...") }
            item { Spacer(Modifier.height(4.dp)) }
        }

        if (state.ended) {
            Notice("Percakapan ini sudah diakhiri. Pilih Pesan Baru untuk memulai kembali.")
        } else {
            if (state.canRequestAgent) {
                OutlinedButton(onClick = { scope.launch { client.requestAgent() } }, modifier = Modifier.align(Alignment.CenterHorizontally).padding(top = 6.dp)) {
                    Text(state.site?.settings?.agentButtonLabel ?: "Hubungi Agent", color = accent)
                }
            }
            Row(Modifier.fillMaxWidth().background(Color(0xFF18181B)).padding(8.dp), verticalAlignment = Alignment.CenterVertically) {
                if (state.agentHandling && state.site?.settings?.allowAttachments == true && onRequestImage != null) {
                    TextButton(onClick = { scope.launch { onRequestImage()?.let { client.uploadImage(it.file, it.mimeType, it.caption) } } }) { Text("Foto", color = accent) }
                }
                OutlinedTextField(
                    value = text,
                    onValueChange = { text = it.take(4000); client.notifyTyping(it.isNotBlank()) },
                    modifier = Modifier.weight(1f),
                    placeholder = { Text("Tulis pesan...") },
                    maxLines = 4,
                    enabled = state.connected,
                )
                Button(
                    onClick = { val outgoing = text; text = ""; client.notifyTyping(false); scope.launch { client.sendMessage(outgoing) } },
                    enabled = text.isNotBlank() && state.connected,
                    colors = ButtonDefaults.buttonColors(containerColor = accent),
                    modifier = Modifier.padding(start = 8.dp),
                ) { Text("Kirim", color = Color.Black) }
            }
        }
    }
}

@Composable
private fun MessageBubble(message: ChatMessage, accent: Color) {
    val visitor = message.senderType == "VISITOR"
    Row(Modifier.fillMaxWidth(), horizontalArrangement = if (visitor) Arrangement.End else Arrangement.Start) {
        Column(
            Modifier.widthIn(max = 310.dp).background(if (visitor) accent else Color(0xFF27272A), RoundedCornerShape(14.dp)).padding(horizontal = 12.dp, vertical = 9.dp),
        ) {
            if (!visitor) Text(message.senderName ?: if (message.senderType == "AI") "AI" else "Agent", color = accent, style = MaterialTheme.typography.labelSmall)
            Text(message.content.ifBlank { if (message.messageType == "IMAGE") "Gambar" else "" }, color = if (visitor) Color.Black else Color.White)
        }
    }
}

@Composable
private fun PreChatForm(accent: Color, onSubmit: (PreChatInput) -> Unit) {
    var name by remember { mutableStateOf("") }; var email by remember { mutableStateOf("") }
    var phone by remember { mutableStateOf("") }; var message by remember { mutableStateOf("") }; var consent by remember { mutableStateOf(false) }
    val valid = name.isNotBlank() && EMAIL.matches(email.trim()) && phone.count(Char::isDigit) >= 8 && message.isNotBlank() && consent
    FormColumn("Sebelum memulai, boleh kami tahu sedikit tentang Anda?") {
        Field(name, { name = it.take(120) }, "Nama Anda")
        Field(email, { email = it.take(160) }, "Email", KeyboardType.Email)
        Field(phone, { phone = it.take(30) }, "No. Telepon / WhatsApp", KeyboardType.Phone)
        Field(message, { message = it.take(2000) }, "Pesan pertama", lines = 3)
        Row(verticalAlignment = Alignment.CenterVertically) { Checkbox(consent, { consent = it }); Text("Saya menyetujui penggunaan data sesuai kebijakan privasi.", color = Color.LightGray, style = MaterialTheme.typography.bodySmall) }
        Button(onClick = { onSubmit(PreChatInput(name.trim(), email.trim(), phone.trim(), message.trim(), consent)) }, enabled = valid, modifier = Modifier.fillMaxWidth(), colors = ButtonDefaults.buttonColors(containerColor = accent)) { Text("Mulai Percakapan", color = Color.Black) }
    }
}

@Composable
private fun TicketForm(state: SolidChatState, accent: Color, onSubmit: (TicketInput) -> Unit, onReset: () -> Unit) {
    if (state.ticketNumber != null) {
        CenterMessage {
            Text("Tiket Anda berhasil dikirim", color = Color.White)
            Text(state.ticketNumber.orEmpty(), color = accent)
            Text("Tim kami akan menghubungi Anda secepatnya.", color = Color.Gray)
            Button(onClick = onReset, colors = ButtonDefaults.buttonColors(containerColor = accent)) { Text("Kirim tiket lagi", color = Color.Black) }
        }
        return
    }
    var name by remember { mutableStateOf("") }; var email by remember { mutableStateOf("") }; var phone by remember { mutableStateOf("") }
    var subject by remember { mutableStateOf("") }; var description by remember { mutableStateOf("") }
    val valid = name.isNotBlank() && EMAIL.matches(email.trim()) && phone.count(Char::isDigit) >= 8 && subject.isNotBlank() && description.trim().length >= 5
    FormColumn(state.site?.offlineMessage?.ifBlank { "Tim kami sedang offline. Tinggalkan pesan dan kami akan menghubungi Anda." }.orEmpty()) {
        Field(name, { name = it.take(120) }, "Nama Anda"); Field(email, { email = it }, "Email", KeyboardType.Email)
        Field(phone, { phone = it.take(30) }, "No. Telepon / WhatsApp", KeyboardType.Phone); Field(subject, { subject = it.take(200) }, "Subjek")
        Field(description, { description = it }, "Ceritakan kebutuhan Anda", lines = 4)
        Button(onClick = { onSubmit(TicketInput(name.trim(), email.trim(), phone.trim(), subject.trim(), description.trim())) }, enabled = valid, modifier = Modifier.fillMaxWidth(), colors = ButtonDefaults.buttonColors(containerColor = accent)) { Text("Kirim Tiket", color = Color.Black) }
    }
}

@Composable private fun FormColumn(title: String, content: @Composable ColumnScope.() -> Unit) = Column(Modifier.fillMaxSize().padding(20.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) { Text(title, color = Color.LightGray); content() }
@Composable private fun Field(value: String, onChange: (String) -> Unit, label: String, keyboard: KeyboardType = KeyboardType.Text, lines: Int = 1) = OutlinedTextField(value, onChange, Modifier.fillMaxWidth(), label = { Text(label) }, keyboardOptions = KeyboardOptions(keyboardType = keyboard), minLines = lines, maxLines = lines)
@Composable private fun Notice(text: String) = Text(text, color = Color.Gray, style = MaterialTheme.typography.bodySmall, modifier = Modifier.fillMaxWidth().padding(8.dp))
@Composable private fun CenterMessage(content: @Composable ColumnScope.() -> Unit) = Column(Modifier.fillMaxSize().padding(24.dp), verticalArrangement = Arrangement.spacedBy(12.dp, Alignment.CenterVertically), horizontalAlignment = Alignment.CenterHorizontally, content = content)

@Composable
private fun RatingDialog(accent: Color, onDismiss: () -> Unit, onSubmit: (Int, String?) -> Unit) {
    var score by remember { mutableIntStateOf(5) }; var comment by remember { mutableStateOf("") }
    AlertDialog(onDismissRequest = onDismiss, title = { Text("Nilai layanan kami") }, text = {
        Column { Row { (1..5).forEach { value -> TextButton(onClick = { score = value }) { Text(if (value <= score) "★" else "☆", color = accent) } } }; Field(comment, { comment = it.take(1000) }, "Komentar (opsional)", lines = 3) }
    }, confirmButton = { Button(onClick = { onSubmit(score, comment.trim().ifBlank { null }) }, colors = ButtonDefaults.buttonColors(containerColor = accent)) { Text("Kirim", color = Color.Black) } }, dismissButton = { TextButton(onClick = onDismiss) { Text("Nanti") } })
}

private val EMAIL = Regex("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$")
private fun parseColor(hex: String?): Color = runCatching { Color(android.graphics.Color.parseColor(hex ?: "#D4AF37")) }.getOrDefault(Color(0xFFD4AF37))
