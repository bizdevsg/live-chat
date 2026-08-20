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
import { VisitorAuthGuard, type VisitorRequest } from "./guards/visitor-auth.guard";
import {
  CreateWidgetSessionDto,
  IdentifyDto,
  RequestAgentDto,
  SendWidgetMessageDto,
  WidgetFeedbackDto,
} from "./dto/widget.dto";
import { CreateLeadDto } from "../leads/dto/lead.dto";

@ApiTags("widget")
@Public()
@Controller("api/v1/widget")
export class WidgetController {
  constructor(
    private readonly widgetService: WidgetService,
    private readonly conversations: ConversationsService,
    private readonly aiOrchestrator: AiOrchestratorService,
    private readonly leadsService: LeadsService,
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
    const conversation = await this.widgetService.ensureConversation(req.visitor.siteId, req.visitor.visitorId, dto as CreateWidgetSessionDto);
    return { success: true, data: conversation };
  }

  @UseGuards(VisitorAuthGuard)
  @Get("conversations/:id")
  async getConversation(@Param("id") id: string, @Req() req: VisitorRequest) {
    const conversation = await this.widgetService.assertOwnership(id, req.visitor.visitorId);
    const messages = await this.conversations.getHistory(id, 100);
    return { success: true, data: { conversation, messages: messages.filter((m) => !m.isInternal) } };
  }

  @UseGuards(VisitorAuthGuard)
  @Post("conversations/:id/messages")
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async sendMessage(@Param("id") id: string, @Body() dto: SendWidgetMessageDto, @Req() req: VisitorRequest) {
    await this.widgetService.assertOwnership(id, req.visitor.visitorId);
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
    await this.widgetService.assertOwnership(id, req.visitor.visitorId);
    const reason = (dto.reason as HandoffReason) || HandoffReason.CUSTOMER_REQUESTED_HUMAN;
    const data = await this.conversations.requestAgent(id, reason);
    this.aiOrchestrator.summarize(id, "HANDOFF").catch(() => undefined);
    return { success: true, data };
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
    await this.widgetService.assertOwnership(id, req.visitor.visitorId);
    await this.conversations.submitFeedback(id, dto.score, dto.comment);
    return { success: true, data: null };
  }

  @UseGuards(VisitorAuthGuard)
  @Post("conversations/:id/lead")
  async submitLead(@Param("id") id: string, @Body() dto: CreateLeadDto, @Req() req: VisitorRequest) {
    await this.widgetService.assertOwnership(id, req.visitor.visitorId);
    const data = await this.leadsService.createFromWidget(req.visitor.siteId, id, dto);
    return { success: true, data: { id: data.id, syncStatus: data.syncStatus, conversationId: data.conversationId, resumedConversation: data.resumedConversation } };
  }

  @UseGuards(VisitorAuthGuard)
  @Post("identify")
  async identify(@Body() dto: IdentifyDto, @Req() req: VisitorRequest) {
    const data = await this.widgetService.identify(req.visitor.siteId, req.visitor.visitorId, dto.identityToken);
    return { success: true, data };
  }
}
