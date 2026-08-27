import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Permission, type JwtAccessPayload } from "@solidchat/shared";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AgentService } from "./agent.service";
import { ConversationsService } from "../conversations/conversations.service";
import { AiOrchestratorService } from "../ai/ai-orchestrator.service";
import { FindCrmCustomerByEmailDto, InternalNoteDto, SendAgentMessageDto, TransferConversationDto, UpdateAgentStatusDto } from "./dto/agent.dto";

@ApiTags("agent")
@UseGuards(PermissionsGuard)
@RequirePermissions(Permission.CONVERSATION_HANDLE)
@Controller("api/v1/agent")
export class AgentController {
  constructor(
    private readonly agentService: AgentService,
    private readonly conversations: ConversationsService,
    private readonly aiOrchestrator: AiOrchestratorService,
  ) {}

  @Get("queue")
  async queue(@CurrentUser() user: JwtAccessPayload) {
    const data = await this.agentService.queue(user);
    return { success: true, data };
  }

  @Get("conversations")
  async myConversations(@CurrentUser() user: JwtAccessPayload, @Query("status") status?: string) {
    const data = await this.agentService.myConversations(user, status);
    return { success: true, data };
  }

  @Get("conversations/:id")
  async getConversation(@Param("id") id: string, @CurrentUser() user: JwtAccessPayload) {
    const data = await this.agentService.getConversationDetail(user, id);
    return { success: true, data };
  }

  @Get("crm/customer")
  async findCrmCustomerByEmail(@Query() query: FindCrmCustomerByEmailDto, @CurrentUser() user: JwtAccessPayload) {
    const data = await this.agentService.findCrmCustomerByEmail(user, query.email);
    return { success: true, data };
  }

  @Post("conversations/:id/accept")
  async accept(@Param("id") id: string, @CurrentUser() user: JwtAccessPayload) {
    await this.agentService.assertConversationAccess(user, id);
    const data = await this.conversations.accept(id, user.sub);
    return { success: true, data };
  }

  @Post("conversations/:id/takeover")
  @RequirePermissions(Permission.CONVERSATION_TAKEOVER)
  async takeover(@Param("id") id: string, @CurrentUser() user: JwtAccessPayload) {
    await this.agentService.assertConversationAccess(user, id);
    const data = await this.conversations.takeover(id, user.sub);
    return { success: true, data };
  }

  @Post("conversations/:id/return-to-ai")
  async returnToAi(@Param("id") id: string, @CurrentUser() user: JwtAccessPayload) {
    await this.agentService.assertConversationAccess(user, id);
    const data = await this.conversations.returnToAi(id, user.sub);
    return { success: true, data };
  }

  @Post("conversations/:id/messages")
  async sendMessage(@Param("id") id: string, @Body() dto: SendAgentMessageDto, @CurrentUser() user: JwtAccessPayload) {
    await this.agentService.assertConversationAccess(user, id);
    const result = await this.conversations.postMessage({
      conversationId: id,
      senderType: "AGENT",
      senderId: user.sub,
      content: dto.content,
      clientMessageId: dto.clientMessageId,
    });
    return { success: true, data: result.message };
  }

  @Post("conversations/:id/internal-notes")
  async internalNote(@Param("id") id: string, @Body() dto: InternalNoteDto, @CurrentUser() user: JwtAccessPayload) {
    await this.agentService.assertConversationAccess(user, id);
    const result = await this.conversations.addInternalNote(id, user.sub, dto.content);
    return { success: true, data: result.message };
  }

  @Post("conversations/:id/transfer")
  @RequirePermissions(Permission.CONVERSATION_TRANSFER)
  async transfer(@Param("id") id: string, @Body() dto: TransferConversationDto, @CurrentUser() user: JwtAccessPayload) {
    await this.agentService.assertConversationAccess(user, id);
    const data = await this.conversations.transfer(id, user.sub, dto);
    return { success: true, data };
  }

  @Post("conversations/:id/resolve")
  async resolve(@Param("id") id: string, @CurrentUser() user: JwtAccessPayload) {
    await this.agentService.assertConversationAccess(user, id);
    const data = await this.conversations.resolve(id, user.sub);
    this.aiOrchestrator.summarize(id, "RESOLVED").catch(() => undefined);
    return { success: true, data };
  }

  @Post("conversations/:id/reopen")
  async reopen(@Param("id") id: string, @CurrentUser() user: JwtAccessPayload) {
    await this.agentService.assertConversationAccess(user, id);
    const data = await this.conversations.reopen(id, user.sub);
    return { success: true, data };
  }

  @Post("conversations/:id/suggested-reply")
  async suggestedReply(@Param("id") id: string, @CurrentUser() user: JwtAccessPayload) {
    await this.agentService.assertConversationAccess(user, id);
    const data = await this.aiOrchestrator.generateSuggestedReplyForAgent(id, user.sub);
    return { success: true, data };
  }

  @Post("conversations/:id/summary")
  async summary(@Param("id") id: string, @CurrentUser() user: JwtAccessPayload) {
    await this.agentService.assertConversationAccess(user, id);
    const data = await this.aiOrchestrator.summarize(id, "MANUAL");
    return { success: true, data };
  }

  @Get("status")
  async getStatus(@CurrentUser() user: JwtAccessPayload) {
    const data = await this.agentService.getStatus(user.sub);
    return { success: true, data };
  }

  @Post("status")
  async status(@Body() dto: UpdateAgentStatusDto, @CurrentUser() user: JwtAccessPayload) {
    await this.agentService.setStatus(user.sub, user.organizationId, dto.availability);
    return { success: true, data: null };
  }
}
