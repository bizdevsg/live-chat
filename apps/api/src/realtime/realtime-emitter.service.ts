import { Injectable } from "@nestjs/common";
import type { Server } from "socket.io";

/**
 * Central place any service can push realtime events through, without importing a
 * concrete Gateway (avoids circular DI between ConversationsService <-> Gateways).
 * Gateways register their `Server` instance here in `afterInit`.
 */
@Injectable()
export class RealtimeEmitterService {
  private widgetServer?: Server;
  private dashboardServer?: Server;

  registerWidgetServer(server: Server) {
    this.widgetServer = server;
  }

  registerDashboardServer(server: Server) {
    this.dashboardServer = server;
  }

  private conversationRoom(conversationId: string) {
    return `conversation:${conversationId}`;
  }

  toConversation(conversationId: string, event: string, payload: unknown) {
    const room = this.conversationRoom(conversationId);
    this.widgetServer?.to(room).emit(event, payload);
    this.dashboardServer?.to(room).emit(event, payload);
  }

  toAgent(agentId: string, event: string, payload: unknown) {
    this.dashboardServer?.to(`agent:${agentId}`).emit(event, payload);
  }

  toTeam(teamId: string, event: string, payload: unknown) {
    this.dashboardServer?.to(`team:${teamId}`).emit(event, payload);
  }

  toSite(siteId: string, event: string, payload: unknown) {
    this.dashboardServer?.to(`site:${siteId}`).emit(event, payload);
    this.widgetServer?.to(`site:${siteId}`).emit(event, payload);
  }

  toOrganizationDashboard(organizationId: string, event: string, payload: unknown) {
    this.dashboardServer?.to(`org:${organizationId}`).emit(event, payload);
  }
}
