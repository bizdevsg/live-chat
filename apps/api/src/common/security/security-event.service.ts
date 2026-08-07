import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { NotificationsService } from "../../notifications/notifications.service";

export type SecurityEventType =
  | "FAILED_LOGIN"
  | "ACCOUNT_LOCKED"
  | "RATE_LIMITED"
  | "SENSITIVE_DATA_DETECTED"
  | "PROMPT_INJECTION_DETECTED"
  | "CORS_BLOCKED"
  | "DOMAIN_NOT_ALLOWED"
  | "WEBSOCKET_UNAUTHORIZED"
  | "CROSS_CONVERSATION_ACCESS_ATTEMPT"
  | "FILE_TYPE_REJECTED";

export type SecurityEventSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

@Injectable()
export class SecurityEventService {
  private readonly logger = new Logger(SecurityEventService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async record(params: {
    organizationId?: string | null;
    type: SecurityEventType;
    severity?: SecurityEventSeverity;
    actorId?: string | null;
    ipAddress?: string | null;
    details?: unknown;
  }): Promise<void> {
    this.logger.warn(`security_event ${params.type} severity=${params.severity ?? "LOW"}`);
    await this.prisma.securityEvent.create({
      data: {
        organizationId: params.organizationId ?? null,
        type: params.type,
        severity: params.severity ?? "LOW",
        actorId: params.actorId ?? null,
        ipAddress: params.ipAddress ?? null,
        details: params.details ? (params.details as object) : undefined,
      },
    });

    if (params.organizationId && (params.severity === "HIGH" || params.severity === "CRITICAL")) {
      this.notifications.notifyOrganization(
        params.organizationId,
        "SECURITY_EVENT",
        `Security event: ${params.type}`,
        `Severity ${params.severity}. Periksa halaman Security untuk detail.`,
      );
    }
  }
}
