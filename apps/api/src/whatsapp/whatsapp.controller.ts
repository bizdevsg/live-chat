import { Body, Controller, Delete, Get, Headers, Param, Post, Query, RawBodyRequest, Req, UseGuards } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiTags } from "@nestjs/swagger";
import { Permission, type JwtAccessPayload } from "@solidchat/shared";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { Request } from "express";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { Public } from "../common/decorators/public.decorator";
import { UnauthorizedApiException } from "../common/errors/api.exception";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { ConnectWhatsAppDto, SendWhatsAppMessageDto } from "./dto/whatsapp.dto";
import { WhatsAppConnectionService } from "./whatsapp-connection.service";
import { WhatsAppInboundService } from "./whatsapp-inbound.service";
import { WhatsAppInboxService } from "./whatsapp-inbox.service";

@ApiTags("whatsapp")
@Controller("api/v1/whatsapp")
export class WhatsAppController {
  constructor(
    private readonly connections: WhatsAppConnectionService,
    private readonly inbound: WhatsAppInboundService,
    private readonly inbox: WhatsAppInboxService,
    private readonly config: ConfigService,
  ) {}

  @Get("connection")
  @UseGuards(PermissionsGuard)
  @RequirePermissions(Permission.CONVERSATION_HANDLE)
  connection(@CurrentUser() user: JwtAccessPayload) {
    return this.connections.get(user.organizationId).then((data) => ({ success: true, data }));
  }

  @Post("connection")
  @UseGuards(PermissionsGuard)
  @RequirePermissions(Permission.INTEGRATION_MANAGE)
  connect(@CurrentUser() user: JwtAccessPayload, @Body() dto: ConnectWhatsAppDto) {
    return this.connections.connect(user.organizationId, dto).then((data) => ({ success: true, data }));
  }

  @Get("connection/qr")
  @UseGuards(PermissionsGuard)
  @RequirePermissions(Permission.INTEGRATION_MANAGE)
  qr(@CurrentUser() user: JwtAccessPayload) {
    return this.connections.qr(user.organizationId).then((data) => ({ success: true, data }));
  }

  @Delete("connection")
  @UseGuards(PermissionsGuard)
  @RequirePermissions(Permission.INTEGRATION_MANAGE)
  disconnect(@CurrentUser() user: JwtAccessPayload) {
    return this.connections.disconnect(user.organizationId).then((data) => ({ success: true, data }));
  }

  @Get("chats")
  @UseGuards(PermissionsGuard)
  @RequirePermissions(Permission.CONVERSATION_HANDLE)
  chats(@CurrentUser() user: JwtAccessPayload, @Query("limit") limit?: string, @Query("offset") offset?: string) {
    return this.inbox.listChats(user.organizationId, this.limit(limit), this.offset(offset)).then((data) => ({ success: true, data }));
  }

  @Get("chats/:chatId/contact")
  @UseGuards(PermissionsGuard)
  @RequirePermissions(Permission.CONVERSATION_HANDLE)
  contact(@CurrentUser() user: JwtAccessPayload, @Param("chatId") chatId: string) {
    return this.inbox.getContact(user.organizationId, chatId).then((data) => ({ success: true, data }));
  }

  @Get("chats/:chatId/messages")
  @UseGuards(PermissionsGuard)
  @RequirePermissions(Permission.CONVERSATION_HANDLE)
  messages(
    @CurrentUser() user: JwtAccessPayload,
    @Param("chatId") chatId: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
  ) {
    return this.inbox.getMessages(user.organizationId, chatId, this.limit(limit), this.offset(offset)).then((data) => ({ success: true, data }));
  }

  @Post("chats/:chatId/messages")
  @UseGuards(PermissionsGuard)
  @RequirePermissions(Permission.CONVERSATION_HANDLE)
  sendMessage(@CurrentUser() user: JwtAccessPayload, @Param("chatId") chatId: string, @Body() dto: SendWhatsAppMessageDto) {
    return this.inbox.sendText(user.organizationId, chatId, dto.text).then((data) => ({ success: true, data }));
  }

  @Post("chats/:chatId/read")
  @UseGuards(PermissionsGuard)
  @RequirePermissions(Permission.CONVERSATION_HANDLE)
  markRead(@CurrentUser() user: JwtAccessPayload, @Param("chatId") chatId: string) {
    return this.inbox.markRead(user.organizationId, chatId).then((data) => ({ success: true, data }));
  }

  @Public()
  @Post("webhooks/waha")
  async webhook(
    @Req() request: RawBodyRequest<Request>,
    @Headers("x-webhook-hmac") signature?: string,
    @Body() event?: Record<string, unknown>,
  ) {
    this.assertWebhookSignature(request.rawBody, event, signature);
    await this.inbound.handle(event ?? {});
    return { success: true, data: null };
  }

  private assertWebhookSignature(rawBody: Buffer | undefined, event: Record<string, unknown> | undefined, signature?: string) {
    const secret = this.config.get<string>("WAHA_WEBHOOK_HMAC_KEY")?.trim();
    if (!secret || !signature) throw new UnauthorizedApiException("Signature webhook WAHA tidak ditemukan.");
    const body = rawBody ?? Buffer.from(JSON.stringify(event ?? {}));
    const expected = createHmac("sha512", secret).update(body).digest("hex");
    const received = signature.trim().toLowerCase();
    const expectedBuffer = Buffer.from(expected, "hex");
    const receivedBuffer = /^[a-f0-9]{128}$/.test(received) ? Buffer.from(received, "hex") : Buffer.alloc(0);
    if (expectedBuffer.length !== receivedBuffer.length || !timingSafeEqual(expectedBuffer, receivedBuffer)) {
      throw new UnauthorizedApiException("Signature webhook WAHA tidak valid.");
    }
  }

  private limit(value?: string) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.min(100, Math.max(1, Math.floor(parsed))) : 100;
  }

  private offset(value?: string) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
  }
}
