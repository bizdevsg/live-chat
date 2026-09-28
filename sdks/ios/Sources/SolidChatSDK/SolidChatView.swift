import SwiftUI

public struct SolidChatImage: Sendable {
    public let data: Data
    public let fileName: String
    public let mimeType: String
    public let caption: String
    public init(data: Data, fileName: String, mimeType: String, caption: String = "") {
        self.data = data; self.fileName = fileName; self.mimeType = mimeType; self.caption = caption
    }
}

public struct SolidChatView: View {
    @ObservedObject private var client: SolidChatClient
    private let context: SolidChatSessionContext
    private let imageProvider: (() async -> SolidChatImage?)?
    private let onClose: (() -> Void)?
    @State private var showRating = false

    public init(client: SolidChatClient, context: SolidChatSessionContext = .init(), imageProvider: (() async -> SolidChatImage?)? = nil, onClose: (() -> Void)? = nil) {
        self.client = client; self.context = context; self.imageProvider = imageProvider; self.onClose = onClose
    }

    public var body: some View {
        let accent = Color(hex: client.state.site?.widgetColor)
        VStack(spacing: 0) {
            header(accent)
            Group {
                if client.state.loading { ProgressView().tint(accent).frame(maxWidth: .infinity, maxHeight: .infinity) }
                else if let error = client.state.error, client.state.site == nil { centered(error.message).foregroundStyle(.red) }
                else if client.state.site?.settings?.widgetEnabled == false { centered(client.state.site?.offlineMessage ?? "Widget tidak tersedia.") }
                else if client.state.conversation == nil { centered("Menyiapkan percakapan...") }
                else if client.state.offline { TicketFormView(client: client, accent: accent) }
                else if !client.state.leadSubmitted { PreChatFormView(client: client, accent: accent) }
                else { ChatContentView(client: client, accent: accent, imageProvider: imageProvider) }
            }
        }
        .background(Color(red: 0.035, green: 0.035, blue: 0.043))
        .foregroundStyle(.white)
        .task { await client.initialize(context: context) }
        .onChange(of: client.state.ended) { ended in if ended && client.state.site?.settings?.ratingFormEnabled != false { showRating = true } }
        .sheet(isPresented: $showRating) { RatingView(client: client, accent: accent, presented: $showRating) }
    }

    private func header(_ accent: Color) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(client.state.site?.name ?? "SolidChat").font(.headline)
                Text(client.state.connected ? "Terhubung" : "Menghubungkan...").font(.caption).foregroundStyle(client.state.connected ? accent : .secondary)
            }
            Spacer()
            if client.state.ended { Button("Pesan Baru") { Task { try? await client.startNewConversation() } }.tint(accent) }
            else if client.state.conversation != nil { Button("Akhiri") { Task { try? await client.closeConversation() } }.foregroundStyle(.secondary) }
            if let onClose { Button("Tutup", action: onClose).foregroundStyle(.secondary) }
        }
        .padding().background(Color(red: 0.095, green: 0.095, blue: 0.106))
    }

    private func centered(_ text: String) -> some View { Text(text).foregroundStyle(.secondary).multilineTextAlignment(.center).frame(maxWidth: .infinity, maxHeight: .infinity).padding() }
}

private struct ChatContentView: View {
    @ObservedObject var client: SolidChatClient
    let accent: Color
    let imageProvider: (() async -> SolidChatImage?)?
    @State private var text = ""

    var body: some View {
        VStack(spacing: 0) {
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(spacing: 8) {
                        ForEach(client.state.messages) { message in MessageBubble(message: message, accent: accent).id(message.id) }
                        if client.state.agentRequested { notice("Sedang menghubungkan Anda dengan agent...") }
                        if client.state.agentTyping { notice("\(client.state.agentTypingName ?? "Agent") sedang mengetik...") }
                        if client.state.aiTyping { notice("\(client.state.site?.aiName ?? "AI") sedang mengetik...") }
                    }.padding(12)
                }
                .onChange(of: client.state.messages.count) { _ in if let id = client.state.messages.last?.id { withAnimation { proxy.scrollTo(id, anchor: .bottom) } } }
            }
            if client.state.ended { notice("Percakapan ini sudah diakhiri. Pilih Pesan Baru untuk memulai kembali.").padding() }
            else {
                if client.state.canRequestAgent {
                    Button(client.state.site?.settings?.agentButtonLabel ?? "Hubungi Agent") { Task { try? await client.requestAgent() } }
                        .buttonStyle(.bordered).tint(accent).padding(.top, 6)
                }
                HStack(alignment: .bottom, spacing: 8) {
                    if client.state.agentHandling && client.state.site?.settings?.allowAttachments == true, let imageProvider {
                        Button("Foto") { Task { if let image = await imageProvider() { try? await client.uploadImage(data: image.data, fileName: image.fileName, mimeType: image.mimeType, caption: image.caption) } } }.tint(accent)
                    }
                    TextField("Tulis pesan...", text: $text, axis: .vertical)
                        .lineLimit(1...4).textFieldStyle(.roundedBorder)
                        .onChange(of: text) { value in if value.count > 4000 { text = String(value.prefix(4000)) }; client.notifyTyping(!value.isEmpty) }
                    Button("Kirim") {
                        let outgoing = text; text = ""; client.notifyTyping(false); Task { try? await client.sendMessage(outgoing) }
                    }.buttonStyle(.borderedProminent).tint(accent).disabled(text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || !client.state.connected)
                }.padding(8).background(Color(red: 0.095, green: 0.095, blue: 0.106))
            }
        }
    }

    private func notice(_ text: String) -> some View { Text(text).font(.caption).foregroundStyle(.secondary).frame(maxWidth: .infinity, alignment: .leading) }
}

private struct MessageBubble: View {
    let message: ChatMessage; let accent: Color
    var body: some View {
        HStack {
            if message.senderType == "VISITOR" { Spacer(minLength: 44) }
            VStack(alignment: .leading, spacing: 3) {
                if message.senderType != "VISITOR" { Text(message.senderName ?? (message.senderType == "AI" ? "AI" : "Agent")).font(.caption2).foregroundStyle(accent) }
                Text(message.content.isEmpty && message.messageType == "IMAGE" ? "Gambar" : message.content).foregroundStyle(message.senderType == "VISITOR" ? .black : .white)
            }.padding(.horizontal, 12).padding(.vertical, 9).background(message.senderType == "VISITOR" ? accent : Color(red: 0.15, green: 0.15, blue: 0.165), in: RoundedRectangle(cornerRadius: 14))
            if message.senderType != "VISITOR" { Spacer(minLength: 44) }
        }
    }
}

private struct PreChatFormView: View {
    @ObservedObject var client: SolidChatClient; let accent: Color
    @State private var name = ""; @State private var email = ""; @State private var phone = ""; @State private var message = ""; @State private var consent = false
    private var valid: Bool { !name.isEmpty && email.isEmail && phone.filter(\.isNumber).count >= 8 && !message.isEmpty && consent }
    var body: some View {
        Form {
            Section("Sebelum memulai, boleh kami tahu sedikit tentang Anda?") {
                TextField("Nama Anda", text: $name); TextField("Email", text: $email).keyboardType(.emailAddress).textInputAutocapitalization(.never)
                TextField("No. Telepon / WhatsApp", text: $phone).keyboardType(.phonePad); TextField("Pesan pertama", text: $message, axis: .vertical).lineLimit(3...5)
                Toggle("Saya menyetujui penggunaan data sesuai kebijakan privasi.", isOn: $consent)
                Button("Mulai Percakapan") { Task { try? await client.submitPreChat(.init(name: name, email: email, phone: phone, message: String(message.prefix(2000)), consentGiven: consent)) } }.disabled(!valid).tint(accent)
            }
        }.scrollContentBackground(.hidden)
    }
}

private struct TicketFormView: View {
    @ObservedObject var client: SolidChatClient; let accent: Color
    @State private var name = ""; @State private var email = ""; @State private var phone = ""; @State private var subject = ""; @State private var description = ""
    private var valid: Bool { !name.isEmpty && email.isEmail && phone.filter(\.isNumber).count >= 8 && !subject.isEmpty && description.count >= 5 }
    var body: some View {
        if let number = client.state.ticketNumber {
            VStack(spacing: 12) { Text("Tiket Anda berhasil dikirim").font(.headline); Text(number).foregroundStyle(accent); Text("Tim kami akan menghubungi Anda secepatnya.").foregroundStyle(.secondary); Button("Kirim tiket lagi") { client.clearTicketNotice() }.tint(accent) }.frame(maxWidth: .infinity, maxHeight: .infinity)
        } else {
            Form { Section(client.state.site?.offlineMessage ?? "Tim kami sedang offline") {
                TextField("Nama Anda", text: $name); TextField("Email", text: $email).keyboardType(.emailAddress).textInputAutocapitalization(.never)
                TextField("No. Telepon / WhatsApp", text: $phone).keyboardType(.phonePad); TextField("Subjek", text: $subject)
                TextField("Ceritakan kebutuhan Anda", text: $description, axis: .vertical).lineLimit(4...7)
                Button("Kirim Tiket") { Task { try? await client.submitTicket(.init(name: name, email: email, phone: phone, subject: subject, description: description)) } }.disabled(!valid).tint(accent)
            } }.scrollContentBackground(.hidden)
        }
    }
}

private struct RatingView: View {
    @ObservedObject var client: SolidChatClient; let accent: Color; @Binding var presented: Bool
    @State private var score = 5; @State private var comment = ""
    var body: some View {
        NavigationStack { Form { Section("Nilai layanan kami") { HStack { ForEach(1...5, id: \.self) { value in Button { score = value } label: { Image(systemName: value <= score ? "star.fill" : "star").foregroundStyle(accent) } } }; TextField("Komentar (opsional)", text: $comment, axis: .vertical).lineLimit(3...5) } }
            .navigationTitle("Rating").toolbar { ToolbarItem(placement: .cancellationAction) { Button("Nanti") { presented = false } }; ToolbarItem(placement: .confirmationAction) { Button("Kirim") { Task { try? await client.submitFeedback(score: score, comment: comment.isEmpty ? nil : String(comment.prefix(1000))); presented = false } } } }
        }
    }
}

private extension String {
    var isEmail: Bool { range(of: #"^[^\s@]+@[^\s@]+\.[^\s@]+$"#, options: .regularExpression) != nil }
}

private extension Color {
    init(hex: String?) {
        let value = (hex ?? "D4AF37").trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var number: UInt64 = 0; Scanner(string: value).scanHexInt64(&number)
        self.init(red: Double((number >> 16) & 255) / 255, green: Double((number >> 8) & 255) / 255, blue: Double(number & 255) / 255)
    }
}
