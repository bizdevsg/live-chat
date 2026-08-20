import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Logger } from "@nestjs/common";
import type { Server, Socket } from "socket.io";
import { MessageType, SenderType, type JwtAccessPayload } from "@solidchat/shared";
import { Public } from "../common/decorators/public.decorator";
import { PrismaService } from "../prisma/prisma.service";
import { ConversationsService } from "../conversations/conversations.service";
import { TicketsService } from "../tickets/tickets.service";
import { RealtimeEmitterService } from "./realtime-emitter.service";
import { AgentService } from "../agent/agent.service";

interface DashboardSocket extends Socket {
  data: { user: JwtAccessPayload };
}

/**
 * Authenticated namespace for the Admin/CS dashboard (§15). Marked @Public() for the same
 * reason as WidgetGateway — the global HTTP JwtAuthGuard can't run against a ws context,
 * so the access token is verified manually here from the handshake payload.
 */
@Public()
@WebSocketGateway({ namespace: "/dashboard", cors: { origin: true, credentials: true } })
export class DashboardGateway implements OnGatewayInit, OnGatewayConnection {
  private readonly logger = new Logger(DashboardGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly agentService: AgentService,
    private readonly conversations: ConversationsService,
    private readonly tickets: TicketsService,
    private readonly realtime: RealtimeEmitterService,
  ) {}

  afterInit(server: Server) {
    this.realtime.registerDashboardServer(server);
  }

  async handleConnection(client: DashboardSocket) {
    // The access token is an httpOnly cookie (§31), unreadable from client JS by design —
    // socket.io is configured with `withCredentials` so the cookie rides along on the
    // handshake request instead of being passed explicitly in `auth`.
    const token = (client.handshake.auth?.accessToken as string | undefined) ?? this.extractCookie(client, "access_token");
    if (!token) return this.reject(client, "Token akses diperlukan.");

    try {
      const payload = await this.jwt.verifyAsync<JwtAccessPayload>(token, { secret: this.config.get<string>("JWT_ACCESS_SECRET") });
      const session = await this.prisma.session.findUnique({ where: { id: payload.sessionId } });
      if (!session || session.revokedAt) return this.reject(client, "Sesi tidak valid.");

      client.data = { user: payload };
      await client.join(`agent:${payload.sub}`);
      await client.join(`org:${payload.organizationId}`);

      const teams = await this.prisma.teamMember.findMany({ where: { userId: payload.sub } });
      for (const team of teams) await client.join(`team:${team.teamId}`);

      const sites = await this.prisma.site.findMany({ where: { organizationId: payload.organizationId } });
      for (const site of sites) await client.join(`site:${site.id}`);
    } catch {
      this.reject(client, "Token akses tidak valid.");
    }
  }

  private extractCookie(client: Socket, name: string): string | undefined {
    const header = client.handshake.headers.cookie;
    if (!header) return undefined;
    const match = header.split(";").map((c) => c.trim()).find((c) => c.startsWith(`${name}=`));
    return match ? decodeURIComponent(match.slice(name.length + 1)) : undefined;
  }

  private async getAgentDisplayName(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
    return user?.name ?? "Agent";
  }

  private reject(client: Socket, message: string) {
    client.emit("error", { code: "UNAUTHORIZED", message });
    client.disconnect(true);
  }

  @SubscribeMessage("conversation:join")
  async onConversationJoin(@ConnectedSocket() client: DashboardSocket, @MessageBody() body: { conversationId: string }) {
    try {
      await this.agentService.assertConversationAccess(client.data.user, body.conversationId);
    } catch {
      client.emit("error", { code: "FORBIDDEN", message: "Tidak dapat membuka conversation ini." });
      return;
    }
    await client.join(`conversation:${body.conversationId}`);
  }

  @SubscribeMessage("conversation:leave")
  async onConversationLeave(@ConnectedSocket() client: DashboardSocket, @MessageBody() body: { conversationId: string }) {
    await client.leave(`conversation:${body.conversationId}`);
  }

  @SubscribeMessage("agent:status")
  async onAgentStatus(@ConnectedSocket() client: DashboardSocket, @MessageBody() body: { availability: "ONLINE" | "BUSY" | "OFFLINE" }) {
    const userId = client.data.user.sub;
    await this.prisma.agentProfile.update({ where: { userId }, data: { availability: body.availability, lastStatusChangeAt: new Date() } });
    await this.prisma.agentStatusHistory.create({ data: { userId, status: body.availability } });
    this.realtime.toOrganizationDashboard(client.data.user.organizationId, "agent:status", { userId, availability: body.availability });
  }

  @SubscribeMessage("conversation:accept")
  async onAccept(@ConnectedSocket() client: DashboardSocket, @MessageBody() body: { conversationId: string }) {
    await this.agentService.assertConversationAccess(client.data.user, body.conversationId);
    await this.conversations.accept(body.conversationId, client.data.user.sub);
  }

  @SubscribeMessage("conversation:takeover")
  async onTakeover(@ConnectedSocket() client: DashboardSocket, @MessageBody() body: { conversationId: string }) {
    await this.agentService.assertConversationAccess(client.data.user, body.conversationId);
    await this.conversations.takeover(body.conversationId, client.data.user.sub);
  }

  @SubscribeMessage("conversation:return_to_ai")
  async onReturnToAi(@ConnectedSocket() client: DashboardSocket, @MessageBody() body: { conversationId: string }) {
    await this.agentService.assertConversationAccess(client.data.user, body.conversationId);
    await this.conversations.returnToAi(body.conversationId, client.data.user.sub);
  }

  @SubscribeMessage("conversation:transfer")
  async onTransfer(
    @ConnectedSocket() client: DashboardSocket,
    @MessageBody() body: { conversationId: string; toAgentId?: string; toTeamId?: string },
  ) {
    await this.agentService.assertConversationAccess(client.data.user, body.conversationId);
    await this.conversations.transfer(body.conversationId, client.data.user.sub, { toAgentId: body.toAgentId, toTeamId: body.toTeamId });
  }

  @SubscribeMessage("conversation:resolve")
  async onResolve(@ConnectedSocket() client: DashboardSocket, @MessageBody() body: { conversationId: string }) {
    await this.agentService.assertConversationAccess(client.data.user, body.conversationId);
    await this.conversations.resolve(body.conversationId, client.data.user.sub);
  }

  @SubscribeMessage("message:send")
  async onMessageSend(
    @ConnectedSocket() client: DashboardSocket,
    @MessageBody() body: { conversationId: string; content: string; clientMessageId?: string; isInternal?: boolean },
  ) {
    await this.agentService.assertConversationAccess(client.data.user, body.conversationId);
    await this.conversations.postMessage({
      conversationId: body.conversationId,
      senderType: SenderType.AGENT,
      senderId: client.data.user.sub,
      content: body.content,
      messageType: body.isInternal ? MessageType.INTERNAL_NOTE : MessageType.TEXT,
      isInternal: body.isInternal ?? false,
      clientMessageId: body.clientMessageId,
    });
  }

  @SubscribeMessage("message:read")
  async onMessageRead(@ConnectedSocket() client: DashboardSocket, @MessageBody() body: { messageId: string }) {
    const message = await this.prisma.message.findUnique({ where: { id: body.messageId }, select: { conversationId: true } });
    if (message) {
      await this.agentService.assertConversationAccess(client.data.user, message.conversationId);
      await this.conversations.markRead(body.messageId, "AGENT", client.data.user.sub);
      this.realtime.toConversation(message.conversationId, "message:updated", {
        conversationId: message.conversationId,
        messageId: body.messageId,
        readBy: "AGENT",
        readerId: client.data.user.sub,
      });
      return;
    }
  }

  @SubscribeMessage("typing:start")
  async onTypingStart(@ConnectedSocket() client: DashboardSocket, @MessageBody() body: { conversationId: string }) {
    await this.agentService.assertConversationAccess(client.data.user, body.conversationId);
    this.realtime.toConversation(body.conversationId, "typing:updated", {
      from: "AGENT",
      typing: true,
      senderId: client.data.user.sub,
      senderName: await this.getAgentDisplayName(client.data.user.sub),
    });
  }

  @SubscribeMessage("typing:stop")
  async onTypingStop(@ConnectedSocket() client: DashboardSocket, @MessageBody() body: { conversationId: string }) {
    await this.agentService.assertConversationAccess(client.data.user, body.conversationId);
    this.realtime.toConversation(body.conversationId, "typing:updated", {
      from: "AGENT",
      typing: false,
      senderId: client.data.user.sub,
    });
  }

  @SubscribeMessage("ticket:create")
  async onTicketCreate(
    @ConnectedSocket() client: DashboardSocket,
    @MessageBody() body: { conversationId: string; subject: string; description: string; category: string },
  ) {
    await this.agentService.assertConversationAccess(client.data.user, body.conversationId);
    const site = await this.prisma.site.findFirstOrThrow({ where: { organizationId: client.data.user.organizationId } });
    await this.tickets.create(
      client.data.user.organizationId,
      site.id,
      { subject: body.subject, description: body.description, category: body.category, conversationId: body.conversationId },
      client.data.user.sub,
    );
  }
}
