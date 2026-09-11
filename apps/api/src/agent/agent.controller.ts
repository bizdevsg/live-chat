import { Body, Controller, Get, Param, Post, Query, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiTags } from "@nestjs/swagger";
import { MAX_ATTACHMENT_SIZE_BYTES, MessageType, Permission, type JwtAccessPayload } from "@solidchat/shared";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AgentService } from "./agent.service";
import { ConversationsService } from "../conversations/conversations.service";
import { AiOrchestratorService } from "../ai/ai-orchestrator.service";
import { StorageService } from "../storage/storage.service";
import { FindCrmCustomerByEmailDto, InternalNoteDto, SendAgentMessageDto, TransferConversationDto, UpdateAgentStatusDto } from "./dto/agent.dto";
import { assertValidImageUpload, imageExtension } from "../common/utils/image-upload";

@ApiTags("agent")
@UseGuards(PermissionsGuard)
@RequirePermissions(Permission.CONVERSATION_HANDLE)
@Controller("api/v1/agent")
export class AgentController {
  constructor(
    private readonly agentService: AgentService,
    private readonly conversations: ConversationsService,
    private readonly aiOrchestrator: AiOrchestratorService,
    private readonly storage: StorageService,
  ) {}

  @Get("queue")
  async queue(@CurrentUser() user: JwtAccessPayload) {
    const data = await this.agentService.queue(user);
    const withDeadline = await Promise.all(
      data.map(async (conversation) => ({
        ...conversation,
        agentReplyDeadlineAt:
          conversation.handlerType === "AI" || conversation.assignedAgentId
            ? null
            : ((await this.conversations.resolveAgentReplyDeadline(conversation.id))?.toISOString() ?? null),
      })),
    );
    return { success: true, data: withDeadline };
  }

  @Get("conversations")
  async myConversations(@CurrentUser() user: JwtAccessPayload, @Query("status") status?: string) {
    const data = await this.agentService.myConversations(user, status);
    return { success: true, data };
  }

  @Get("closed")
  async closedByVisitorWithoutAgentReply(@CurrentUser() user: JwtAccessPayload) {
    const data = await this.agentService.closedByVisitorWithoutAgentReply(user);
    return { success: true, data };
  }

  @Get("conversations/:id")
  async getConversation(@Param("id") id: string, @CurrentUser() user: JwtAccessPayload) {
    const data = await this.agentService.getConversationDetail(user, id);
    const agentReplyDeadlineAt = (await this.conversations.resolveAgentReplyDeadline(id))?.toISOString() ?? null;
    return { success: true, data: { ...data, agentReplyDeadlineAt } };
  }

  @Get("transfer-candidates")
  @RequirePermissions(Permission.CONVERSATION_TRANSFER)
  async transferCandidates(@CurrentUser() user: JwtAccessPayload) {
    return { success: true, data: await this.agentService.transferCandidates(user) };
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

  @Post("conversations/:id/images")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MAX_ATTACHMENT_SIZE_BYTES } }))
  async uploadImage(@Param("id") id: string, @UploadedFile() file: Express.Multer.File, @Body() dto: SendAgentMessageDto, @CurrentUser() user: JwtAccessPayload) {
    await this.agentService.assertConversationAccess(user, id);
    assertValidImageUpload(file);
    const storageKey = this.storage.buildStorageKey(`conversations/${id}`, `image${imageExtension(file.mimetype)}`);
    await this.storage.upload(storageKey, file.buffer, file.mimetype);
    try {
      const result = await this.conversations.postMessage({
        conversationId: id, senderType: "AGENT", senderId: user.sub, content: dto.content?.trim() || "",
        clientMessageId: dto.clientMessageId, messageType: MessageType.IMAGE,
        attachments: [{ storageKey, fileName: file.originalname, mimeType: file.mimetype, sizeBytes: file.size }],
      });
      if (!result.created) await this.storage.remove(storageKey).catch(() => undefined);
      return { success: true, data: result.message };
    } catch (error) {
      await this.storage.remove(storageKey).catch(() => undefined);
      throw error;
    }
  }

  @Get("conversations/:conversationId/attachments/:attachmentId/url")
  async attachmentUrl(@Param("conversationId") conversationId: string, @Param("attachmentId") attachmentId: string, @CurrentUser() user: JwtAccessPayload) {
    // View access — an attachment from a conversation transferred away should stay viewable.
    await this.agentService.assertConversationViewAccess(user, conversationId);
    const attachment = await this.agentService.getAttachment(conversationId, attachmentId);
    return { success: true, data: { url: await this.storage.getSignedDownloadUrl(attachment.storageKey) } };
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
