import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

export interface RecordAuditLogInput {
  organizationId?: string | null;
  actorType: "USER" | "SYSTEM" | "AI";
  actorId?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  beforeData?: unknown;
  afterData?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
}

const SENSITIVE_KEYS = new Set([
  "password",
  "passwordhash",
  "otp",
  "pin",
  "token",
  "accesstoken",
  "refreshtoken",
  "authorization",
  "secret",
  "apikey",
]);

/** Recursively strips values whose key looks like a credential before anything reaches the audit log (§31). */
function maskSensitive(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(maskSensitive);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, val]) => [
        key,
        SENSITIVE_KEYS.has(key.toLowerCase()) ? "***MASKED***" : maskSensitive(val),
      ]),
    );
  }
  return value;
}

@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: RecordAuditLogInput): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        organizationId: input.organizationId ?? null,
        actorType: input.actorType,
        actorId: input.actorId ?? null,
        action: input.action,
        resourceType: input.resourceType,
        resourceId: input.resourceId ?? null,
        beforeData: input.beforeData ? (maskSensitive(input.beforeData) as object) : undefined,
        afterData: input.afterData ? (maskSensitive(input.afterData) as object) : undefined,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
        requestId: input.requestId ?? null,
      },
    });
  }
}
