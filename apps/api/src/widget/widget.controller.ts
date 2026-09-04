import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Req, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { HandoffReason, MessageType, SenderType } from "@solidchat/shared";
import { Public } from "../common/decorators/public.decorator";
import { WidgetService } from "./widget.service";
import { ConversationsService } from "../conversations/conversations.service";
import { AiOrchestratorService } from "../ai/ai-orchestrator.service";
import { LeadsService } from "../leads/leads.service";
import { TicketsService } from "../tickets/tickets.service";
import { VisitorAuthGuard, type VisitorRequest } from "./guards/visitor-auth.guard";
import {
  CreateWidgetSessionDto,
  CreateWidgetTicketDto,
  IdentifyDto,
  RequestAgentDto,
  SendWidgetMessageDto,
  WidgetFeedbackDto,
} from "./dto/widget.dto";
import { CreateLeadDto } from "../leads/dto/lead.dto";
import { WidgetRateLimitService } from "./widget-rate-limit.service";

@ApiTags("widget")
@Public()
@Controller("api/v1/widget")
export class WidgetController {
  constructor(
    private readonly widgetService: WidgetService,
    private readonly conversations: ConversationsService,
    private readonly aiOrchestrator: AiOrchestratorService,
    private readonly leadsService: LeadsService,
    private readonly ticketsService: TicketsService,
    private readonly widgetRateLimit: WidgetRateLimitService,
  ) {}

  @Get("config/:siteId")
  async config(@Param("siteId") siteId: string) {
    const data = await this.widgetService.getPublicConfig(siteId);
    return { success: true, data };
  }

  @Post("session")
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  async createSession(@Body() dto: CreateWidgetSessionDto, @Req() req: Request) {
    const data = await this.widgetService.createSession(dto, { ip: req.ip, userAgent: req.headers["user-agent"] });
    return { success: true, data };
  }

  @UseGuards(VisitorAuthGuard)
  @Post("conversations")
  async createConversation(@Req() req: VisitorRequest, @Body() dto: Partial<CreateWidgetSessionDto>) {
    await this.widgetRateLimit.consume("conversation", req.visitor.siteId, req.visitor.visitorId, {
      limit: 6,
      windowMs: 60 * 60_000,
      message: "Terlalu banyak percakapan baru. Coba lagi nanti.",
    });
    const conversation = await this.widgetService.ensureConversation(req.visitor.siteId, req.visitor.visitorId, dto as CreateWidgetSessionDto);
    return { success: true, data: conversation };
  }

  @UseGuards(VisitorAuthGuard)
  @Get("conversations/:id")
  async getConversation(@Param("id") id: string, @Req() req: VisitorRequest) {
    await this.widgetService.assertOwnership(id, req.visitor.visitorId);
    // Reopening the widget on a conversation whose agent wait has already elapsed hands it back
    // to the AI here, so the visitor doesn't land on a dead "connecting to an agent" screen.
    await this.conversations.autoReturnToAiIfAgentReplyTimedOut(id).catch(() => undefined);
    const conversation = await this.conversations.getConversationOrThrow(id);
    const messages = await this.conversations.getHistory(id, 100);
    return { success: true, data: { conversation, messages: messages.filter((m) => !m.isInternal) } };
  }

  @UseGuards(VisitorAuthGuard)
  @Post("conversations/:id/messages")
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async sendMessage(@Param("id") id: string, @Body() dto: SendWidgetMessageDto, @Req() req: VisitorRequest) {
    await this.widgetRateLimit.consume("message", req.visitor.siteId, req.visitor.visitorId, {
      limit: 12,
      windowMs: 60_000,
      message: "Terlalu banyak pesan. Tunggu sebentar sebelum mengirim lagi.",
    });
    await this.widgetService.assertOwnership(id, req.visitor.visitorId);
    // If the visitor is stuck in a "waiting for an agent" queue whose wait has already elapsed,
    // hand the conversation back to the AI first — otherwise this message would sit unseen in a
    // queue nobody is watching. Safe no-op while the wait is still running or an agent is active.
    await this.conversations.autoReturnToAiIfAgentReplyTimedOut(id).catch(() => undefined);
    const result = await this.conversations.postMessage({
      conversationId: id,
      senderType: SenderType.VISITOR,
      content: dto.content,
      messageType: (dto.messageType as (typeof MessageType)[keyof typeof MessageType]) ?? MessageType.TEXT,
      clientMessageId: dto.clientMessageId,
    });
    // AI turn processing runs after the message is persisted+broadcast (§16); errors here must
    // never break the visitor-facing send acknowledgement.
    this.aiOrchestrator.scheduleVisitorTurn(id).catch(() => undefined);
    return { success: true, data: result.message };
  }

  @UseGuards(VisitorAuthGuard)
  @Post("conversations/:id/request-agent")
  async requestAgent(@Param("id") id: string, @Body() dto: RequestAgentDto, @Req() req: VisitorRequest) {
    await this.widgetRateLimit.consume("request-agent", req.visitor.siteId, req.visitor.visitorId, {
      limit: 3,
      windowMs: 5 * 60_000,
      message: "Permintaan agent terlalu sering. Coba lagi beberapa menit lagi.",
    });
    await this.widgetService.assertOwnership(id, req.visitor.visitorId);
    const reason = (dto.reason as HandoffReason) || HandoffReason.CUSTOMER_REQUESTED_HUMAN;
    const data = await this.conversations.requestAgent(id, reason);
    this.aiOrchestrator.summarize(id, "HANDOFF").catch(() => undefined);
    return { success: true, data };
  }

  @UseGuards(VisitorAuthGuard)
  @Post("conversations/:id/agent-timeout")
  async agentTimeout(@Param("id") id: string, @Req() req: VisitorRequest) {
    await this.widgetService.assertOwnership(id, req.visitor.visitorId);
    const restored = await this.conversations.autoReturnToAiIfAgentReplyTimedOut(id);
    if (restored && (await this.conversations.hasPendingVisitorMessageSince(id, new Date(0)))) {
      await this.aiOrchestrator.processVisitorTurn(id).catch(() => undefined);
    }
    const conversation = await this.conversations.getConversationOrThrow(id);
    return { success: true, data: { restored, conversation } };
  }

  @UseGuards(VisitorAuthGuard)
  @Post("conversations/:id/close")
  async close(@Param("id") id: string, @Req() req: VisitorRequest) {
    await this.widgetService.assertOwnership(id, req.visitor.visitorId);
    const data = await this.conversations.close(id, "VISITOR");
    return { success: true, data };
  }

  @UseGuards(VisitorAuthGuard)
  @Post("conversations/:id/feedback")
  async feedback(@Param("id") id: string, @Body() dto: WidgetFeedbackDto, @Req() req: VisitorRequest) {
    await this.widgetRateLimit.consume("feedback", req.visitor.siteId, req.visitor.visitorId, {
      limit: 2,
      windowMs: 24 * 60 * 60_000,
      message: "Feedback sudah dikirim. Terima kasih.",
    });
    await this.widgetService.assertOwnership(id, req.visitor.visitorId);
    await this.conversations.submitFeedback(id, dto.score, dto.comment);
    return { success: true, data: null };
  }

  @UseGuards(VisitorAuthGuard)
  @Post("conversations/:id/lead")
  async submitLead(@Param("id") id: string, @Body() dto: CreateLeadDto, @Req() req: VisitorRequest) {
    await this.widgetRateLimit.consume("lead", req.visitor.siteId, req.visitor.visitorId, {
      limit: 3,
      windowMs: 10 * 60_000,
      message: "Data sudah terlalu sering dikirim. Coba lagi beberapa menit lagi.",
    });
    await this.widgetService.assertOwnership(id, req.visitor.visitorId);
    const data = await this.leadsService.createFromWidget(req.visitor.siteId, id, dto);
    if (data.conversationId) {
      const greeting = `Selamat datang di ${data.siteName}, ${data.customerName}. Silakan sampaikan kebutuhan Anda, kami siap membantu.`;
      // A stable per-conversation id makes a retried pre-chat submit return the original greeting instead of duplicating it.
      await this.conversations.postMessage({
        conversationId: data.conversationId,
        senderType: SenderType.AI,
        content: greeting,
        messageType: MessageType.TEXT,
        clientMessageId: `prechat-greeting:${data.conversationId}`,
      });
    }
    return { success: true, data: { id: data.id, syncStatus: data.syncStatus, conversationId: data.conversationId, resumedConversation: data.resumedConversation } };
  }

  @UseGuards(VisitorAuthGuard)
  @Post("conversations/:id/ticket")
  @Throttle({ default: { limit: 3, ttl: 60 * 60_000 } })
  async submitTicket(@Param("id") id: string, @Body() dto: CreateWidgetTicketDto, @Req() req: VisitorRequest) {
    await this.widgetRateLimit.consume("ticket", req.visitor.siteId, req.visitor.visitorId, {
      limit: 3,
      windowMs: 60 * 60_000,
      message: "Maksimal tiga ticket dalam satu jam. Coba lagi nanti.",
    });
    const conversation = await this.widgetService.assertOwnership(id, req.visitor.visitorId);
    const ticket = await this.ticketsService.createFromWidget(
      conversation.organizationId,
      conversation.siteId,
      conversation.id,
      { name: dto.name, email: dto.email, phone: dto.phone },
      { subject: dto.subject, description: dto.description, category: dto.category },
    );
    return { success: true, data: { id: ticket.id, ticketNumber: ticket.ticketNumber } };
  }

  @UseGuards(VisitorAuthGuard)
  @Post("identify")
  async identify(@Body() dto: IdentifyDto, @Req() req: VisitorRequest) {
    const data = await this.widgetService.identify(req.visitor.siteId, req.visitor.visitorId, dto.identityToken);
    return { success: true, data };
  }
}
