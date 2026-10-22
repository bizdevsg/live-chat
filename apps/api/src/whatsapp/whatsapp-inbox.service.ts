import { Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { sanitizePlainText } from "../common/utils/sanitize";
import { PrismaService } from "../prisma/prisma.service";
import { WahaClientService, type WahaChatOverview, type WahaContact, type WahaMessage } from "./waha-client.service";

@Injectable()
export class WhatsAppInboxService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly waha: WahaClientService,
  ) {}

  async listChats(organizationId: string, limit = 100, offset = 0) {
    const connection = await this.connection(organizationId);
    const chats = (await this.waha.getChatsOverview(connection.sessionName, limit, offset)) ?? [];

    return chats
      .filter((chat) => chat.id && this.isDirectChat(chat.id))
      .map((chat) => this.normalizeChat(chat));
  }

  async getContact(organizationId: string, chatId: string) {
    const connection = await this.connection(organizationId);
    this.assertDirectChat(chatId);
    const [contact, picture] = await Promise.all([
      this.waha.getContact(connection.sessionName, chatId).catch(() => null),
      this.waha.getContactPicture(connection.sessionName, chatId).catch(() => null),
    ]);
    return this.normalizeContact(chatId, contact, picture?.profilePictureURL ?? null);
  }

  async getMessages(organizationId: string, chatId: string, limit = 100, offset = 0) {
    const connection = await this.connection(organizationId);
    this.assertDirectChat(chatId);
    const messages = (await this.waha.getChatMessages(connection.sessionName, chatId, limit, offset)) ?? [];
    return messages
      .map((message) => this.normalizeMessage(message))
      .filter((message): message is NonNullable<typeof message> => Boolean(message))
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  async sendText(organizationId: string, chatId: string, text: string) {
    const connection = await this.connection(organizationId);
    this.assertDirectChat(chatId);
    const content = sanitizePlainText(text).trim();
    if (!content) throw new ServiceUnavailableException("Pesan WhatsApp tidak boleh kosong.");
    const response = await this.waha.sendText(connection.sessionName, chatId, content);
    return this.normalizeMessage(response as WahaMessage) ?? response;
  }

  async markRead(organizationId: string, chatId: string) {
    const connection = await this.connection(organizationId);
    this.assertDirectChat(chatId);
    return this.waha.markChatRead(connection.sessionName, chatId);
  }

  private async connection(organizationId: string) {
    const connection = await this.prisma.whatsAppConnection.findUnique({ where: { organizationId } });
    if (!connection) throw new NotFoundException("Koneksi WhatsApp belum dibuat.");
    if (!["CONNECTED", "WORKING"].includes(connection.status)) {
      throw new ServiceUnavailableException("WhatsApp belum terhubung.");
    }
    return connection;
  }

  private normalizeChat(chat: WahaChatOverview) {
    const chatId = chat.id!;
    const raw = chat._chat ?? {};
    const unreadCount = this.firstNumber(raw.unreadCount, raw.unread, raw.unreadMessages) ?? 0;
    const name = this.firstString(chat.name) ?? this.formatPhone(this.phoneFromChatId(chatId));
    return {
      id: chatId,
      name,
      phoneNumber: this.phoneFromChatId(chatId),
      picture: chat.picture ?? null,
      unreadCount,
      lastMessage: chat.lastMessage ? this.normalizeMessage(chat.lastMessage) : null,
    };
  }

  private normalizeContact(chatId: string, contact: WahaContact | null, picture: string | null) {
    const phoneNumber = contact?.number ?? this.phoneFromChatId(chatId);
    return {
      id: contact?.id ?? chatId,
      chatId,
      name: this.firstString(contact?.name, contact?.pushname, contact?.shortName) ?? this.formatPhone(phoneNumber),
      pushName: this.firstString(contact?.pushname, contact?.shortName) ?? null,
      phoneNumber,
      picture,
    };
  }

  private normalizeMessage(message: WahaMessage) {
    if (!message.id) return null;
    const timestamp = typeof message.timestamp === "number" ? message.timestamp : 0;
    return {
      id: message.id,
      timestamp,
      from: message.from ?? null,
      to: message.to ?? null,
      fromMe: message.fromMe === true,
      body: message.body ?? "",
      hasMedia: message.hasMedia === true,
      media: message.media ?? null,
      ack: typeof message.ack === "number" ? message.ack : null,
      ackName: message.ackName ?? null,
    };
  }

  private assertDirectChat(chatId: string) {
    if (!this.isDirectChat(chatId)) throw new NotFoundException("Chat WhatsApp personal tidak ditemukan.");
  }

  private isDirectChat(chatId: string) {
    return chatId.endsWith("@c.us") || chatId.endsWith("@s.whatsapp.net") || chatId.endsWith("@lid");
  }

  private phoneFromChatId(chatId: string) {
    return chatId.split("@")[0]?.replace(/\D/g, "") || chatId;
  }

  private formatPhone(phone: string) {
    return phone ? `+${phone}` : "Kontak WhatsApp";
  }

  private firstString(...values: unknown[]) {
    return values.find((value): value is string => typeof value === "string" && value.trim().length > 0)?.trim();
  }

  private firstNumber(...values: unknown[]) {
    const value = values.find((item) => typeof item === "number" && Number.isFinite(item));
    return typeof value === "number" ? value : null;
  }
}
