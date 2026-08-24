import { Injectable } from "@nestjs/common";
import { RealtimeEmitterService } from "../realtime/realtime-emitter.service";

export type NotificationType =
  | "NEW_WAITING_CONVERSATION"
  | "NEW_INBOX_CONVERSATION"
  | "NEW_CUSTOMER_MESSAGE"
  | "URGENT_CONVERSATION"
  | "NEW_TICKET"
  | "TICKET_SLA_NEAR"
  | "AGENT_TRANSFER"
  | "KNOWLEDGE_REVIEW_NEEDED"
  | "AI_FAILURE_SPIKE"
  | "INTEGRATION_FAILURE"
  | "SECURITY_EVENT";

/**
 * In-app notifications are delivered live over the dashboard socket (`notification:new`)
 * rather than persisted — there is no `notifications` table in §23's schema, so history is
 * intentionally out of scope for this build (documented in README assumptions).
 */
@Injectable()
export class NotificationsService {
  constructor(private readonly realtime: RealtimeEmitterService) {}

  notifyOrganization(organizationId: string, type: NotificationType, title: string, body: string, extra?: Record<string, unknown>) {
    this.realtime.toOrganizationDashboard(organizationId, "notification:new", { type, title, body, ...extra, createdAt: new Date().toISOString() });
  }

  notifyTeam(teamId: string, type: NotificationType, title: string, body: string, extra?: Record<string, unknown>) {
    this.realtime.toTeam(teamId, "notification:new", { type, title, body, ...extra, createdAt: new Date().toISOString() });
  }

  notifyAgent(agentId: string, type: NotificationType, title: string, body: string, extra?: Record<string, unknown>) {
    this.realtime.toAgent(agentId, "notification:new", { type, title, body, ...extra, createdAt: new Date().toISOString() });
  }
}
