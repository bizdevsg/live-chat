import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { Logger } from "@nestjs/common";
import type { Server, Socket } from "socket.io";
import { HandoffReason, MessageType, SenderType } from "@solidchat/shared";
import { Public } from "../common/decorators/public.decorator";
import { VisitorTokenService } from "../widget/visitor-token.service";
import { WidgetService } from "../widget/widget.service";
import { ConversationsService } from "../conversations/conversations.service";
import { AiOrchestratorService } from "../ai/ai-orchestrator.service";
import { RealtimeEmitterService } from "./realtime-emitter.service";

interface WidgetSocket extends Socket {
  data: { visitorId: string; siteId: string };
}

/**
 * Public-facing namespace consumed by the widget iframe app (§15). Marked @Public() so the
 * global JwtAuthGuard (staff-only) doesn't run against ws contexts here — auth is handled
 * manually via the visitor token in the handshake, verified in `handleConnection`.
 */
@Public()
@WebSocketGateway({ namespace: "/widget", cors: { origin: true, credentials: true } })
export class WidgetGateway implements OnGatewayInit, OnGatewayConnection {
  private readonly logger = new Logger(WidgetGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly visitorTokens: VisitorTokenService,
    private readonly widgetService: WidgetService,
    private readonly conversations: ConversationsService,
    private readonly aiOrchestrator: AiOrchestratorService,
    private readonly realtime: RealtimeEmitterService,
  ) {}

  afterInit(server: Server) {
    this.realtime.registerWidgetServer(server);
  }

  async handleConnection(client: WidgetSocket) {
    const token = client.handshake.auth?.visitorToken as string | undefined;
    if (!token) {
      client.emit("error", { code: "UNAUTHORIZED", message: "Token widget diperlukan." });
      client.disconnect(true);
      return;
    }
    try {
      const payload = await this.visitorTokens.verify(token);
      client.data = { visitorId: payload.visitorId, siteId: payload.siteId };
      await client.join(`site:${payload.siteId}`);
    } catch {
      client.emit("error", { code: "UNAUTHORIZED", message: "Token widget tidak valid." });
      client.disconnect(true);
    }
  }

  @SubscribeMessage("widget:join")
  async onJoin(@ConnectedSocket() client: WidgetSocket, @MessageBody() body: { conversationId: string }) {
    try {
      await this.widgetService.assertOwnership(body.conversationId, client.data.visitorId);
      await client.join(`conversation:${body.conversationId}`);
      client.emit("conversation:updated", { conversationId: body.conversationId, joined: true });
    } catch {
      client.emit("error", { code: "FORBIDDEN", message: "Tidak dapat bergabung ke conversation ini." });
    }
  }

  @SubscribeMessage("message:send")
  async onMessageSend(
    @ConnectedSocket() client: WidgetSocket,
    @MessageBody() body: { conversationId: string; content: string; clientMessageId?: string },
  ) {
    try {
      await this.widgetService.assertOwnership(body.conversationId, client.data.visitorId);
      await this.conversations.postMessage({
        conversationId: body.conversationId,
        senderType: SenderType.VISITOR,
        content: body.content,
        messageType: MessageType.TEXT,
        clientMessageId: body.clientMessageId,
      });
      this.aiOrchestrator.processVisitorTurn(body.conversationId).catch((error) => this.logger.error(error));
    } catch {
      client.emit("error", { code: "FORBIDDEN", message: "Tidak dapat mengirim pesan." });
    }
  }

  @SubscribeMessage("typing:start")
  async onTypingStart(@ConnectedSocket() client: WidgetSocket, @MessageBody() body: { conversationId: string }) {
    this.realtime.toConversation(body.conversationId, "typing:updated", { from: "VISITOR", typing: true });
  }

  @SubscribeMessage("typing:stop")
  async onTypingStop(@ConnectedSocket() client: WidgetSocket, @MessageBody() body: { conversationId: string }) {
    this.realtime.toConversation(body.conversationId, "typing:updated", { from: "VISITOR", typing: false });
  }

  @SubscribeMessage("agent:request")
  async onAgentRequest(@ConnectedSocket() client: WidgetSocket, @MessageBody() body: { conversationId: string; reason?: string }) {
    try {
      await this.widgetService.assertOwnership(body.conversationId, client.data.visitorId);
      await this.conversations.requestAgent(body.conversationId, (body.reason as HandoffReason) || HandoffReason.CUSTOMER_REQUESTED_HUMAN);
    } catch {
      client.emit("error", { code: "FORBIDDEN", message: "Tidak dapat meminta agent." });
    }
  }

  @SubscribeMessage("conversation:close")
  async onClose(@ConnectedSocket() client: WidgetSocket, @MessageBody() body: { conversationId: string }) {
    try {
      await this.widgetService.assertOwnership(body.conversationId, client.data.visitorId);
      await this.conversations.close(body.conversationId, "VISITOR");
    } catch {
      client.emit("error", { code: "FORBIDDEN", message: "Tidak dapat menutup conversation." });
    }
  }

  @SubscribeMessage("feedback:submit")
  async onFeedback(@ConnectedSocket() client: WidgetSocket, @MessageBody() body: { conversationId: string; score: number; comment?: string }) {
    try {
      await this.widgetService.assertOwnership(body.conversationId, client.data.visitorId);
      await this.conversations.submitFeedback(body.conversationId, body.score, body.comment);
    } catch {
      client.emit("error", { code: "FORBIDDEN", message: "Tidak dapat mengirim feedback." });
    }
  }

  @SubscribeMessage("message:read")
  async onMessageRead(@ConnectedSocket() client: WidgetSocket, @MessageBody() body: { conversationId: string; messageId: string }) {
    try {
      await this.widgetService.assertOwnership(body.conversationId, client.data.visitorId);
      await this.conversations.markRead(body.messageId, "VISITOR", client.data.visitorId);
      this.realtime.toConversation(body.conversationId, "message:updated", { messageId: body.messageId, readBy: "VISITOR" });
    } catch {
      client.emit("error", { code: "FORBIDDEN", message: "Tidak dapat menandai pesan sebagai dibaca." });
    }
  }
}
