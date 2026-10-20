import { InjectQueue } from "@nestjs/bullmq";
import { Injectable, Logger } from "@nestjs/common";
import { createHmac, randomBytes } from "node:crypto";
import { MessageType, SenderType } from "@solidchat/shared";
import type { Queue } from "bullmq";
import { PrismaService } from "../prisma/prisma.service";
import { ClaraWebhookConfigService } from "./clara-webhook.config";

const COALESCE_DELAY_MS = 7_500;
const MAX_MESSAGES = 1_000;
const MAX_TEXT_LENGTH = 5_000;
const MAX_BODY_BYTES = 5_900_000;
export const CLARA_WEBHOOK_QUEUE = "clara-webhook";
export interface ClaraWebhookJobData {
  conversationId: string;
  eventId: string;
  occurredAt: string;
}
const RETRYABLE_STATUSES = new Set([429, 503]);
const PERMANENT_STATUSES = new Set([401, 413, 415, 422]);

export class PermanentClaraWebhookError extends Error {}
export class RetryableClaraWebhookError extends Error {
  constructor(
    message: string,
    readonly retryAfterMs?: number,
  ) {
    super(message);
  }
}

export function signClaraWebhookBody(
  secret: string,
  timestamp: string,
  body: string,
): string {
  return `sha256=${createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex")}`;
}

@Injectable()
export class ClaraWebhookService {
  private readonly logger = new Logger(ClaraWebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configs: ClaraWebhookConfigService,
    @InjectQueue(CLARA_WEBHOOK_QUEUE)
    private readonly queue: Queue<ClaraWebhookJobData>,
  ) {}

  async scheduleConversation(conversationId: string): Promise<void> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { site: { select: { siteKey: true } } },
    });
    if (!conversation || !this.configs.forSite(conversation.site.siteKey))
      return;

    const baseJobId = `clara-webhook-${conversationId}`;
    const existing = await this.queue.getJob(baseJobId);
    const state = await existing?.getState();
    const jobId = state === "active" ? `${baseJobId}-pending` : baseJobId;
    const pending =
      jobId === baseJobId ? existing : await this.queue.getJob(jobId);
    if (pending && (await pending.getState()) !== "active")
      await pending.remove().catch(() => undefined);

    await this.queue.add(
      "conversation.upserted",
      {
        conversationId,
        eventId: `evt_${randomBytes(16).toString("hex")}`,
        occurredAt: new Date().toISOString(),
      },
      {
        jobId,
        delay: COALESCE_DELAY_MS,
        attempts: 104,
        backoff: { type: "clara-exponential", delay: 5_000 },
        removeOnComplete: true,
        removeOnFail: 1_000,
      },
    );
  }

  async deliver(data: ClaraWebhookJobData): Promise<void> {
    const snapshot = await this.buildSnapshot(data);
    if (!snapshot) return;

    let body = JSON.stringify(snapshot.payload);
    while (
      Buffer.byteLength(body, "utf8") > MAX_BODY_BYTES &&
      snapshot.payload.conversation.messages.length > 1
    ) {
      snapshot.payload.conversation.messages.shift();
      body = JSON.stringify(snapshot.payload);
    }
    const timestamp = Math.floor(Date.now() / 1_000).toString();
    const signature = signClaraWebhookBody(
      snapshot.config.secret,
      timestamp,
      body,
    );
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    let response: Response;
    try {
      response = await fetch(snapshot.config.url, {
        method: "POST",
        redirect: "error",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          "X-Clara-Site-Id": snapshot.config.claraSiteId,
          "X-Clara-Timestamp": timestamp,
          "X-Clara-Signature": signature,
        },
        body,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (response.status === 200) return;
    if (PERMANENT_STATUSES.has(response.status)) {
      this.logger.error(
        `Webhook Clara ditolak permanen: eventId=${data.eventId} status=${response.status}`,
      );
      throw new PermanentClaraWebhookError(
        `clara_webhook_http_${response.status}`,
      );
    }
    if (RETRYABLE_STATUSES.has(response.status) || response.status >= 500) {
      const retryAfterSeconds = Number(response.headers.get("retry-after"));
      throw new RetryableClaraWebhookError(
        `clara_webhook_retryable_http_${response.status}`,
        Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
          ? retryAfterSeconds * 1_000
          : undefined,
      );
    }
    throw new PermanentClaraWebhookError(
      `clara_webhook_unexpected_http_${response.status}`,
    );
  }

  private async buildSnapshot(data: ClaraWebhookJobData) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: data.conversationId },
      include: {
        site: { select: { siteKey: true } },
        customer: { select: { name: true, email: true } },
        leads: { orderBy: { updatedAt: "desc" }, take: 1 },
        messages: {
          where: {
            deletedAt: null,
            isInternal: false,
            messageType: {
              notIn: [MessageType.AI_SUGGESTION, MessageType.INTERNAL_NOTE],
            },
            senderType: {
              in: [
                SenderType.VISITOR,
                SenderType.CUSTOMER,
                SenderType.AGENT,
                SenderType.AI,
              ],
            },
          },
          orderBy: { createdAt: "desc" },
          take: MAX_MESSAGES,
          include: {
            attachments: {
              where: { isInternal: false },
              select: { fileName: true },
            },
          },
        },
      },
    });
    if (!conversation) return null;
    const config = this.configs.forSite(conversation.site.siteKey);
    if (!config) return null;

    const messages = conversation.messages.reverse();
    if (messages.length === 0) return null;
    const agentIds = Array.from(
      new Set(
        messages
          .filter(
            (message) =>
              message.senderType === SenderType.AGENT && message.senderId,
          )
          .map((message) => message.senderId!),
      ),
    );
    if (conversation.assignedAgentId)
      agentIds.push(conversation.assignedAgentId);
    const agents = agentIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: Array.from(new Set(agentIds)) } },
          select: { id: true, name: true, claraUserId: true },
        })
      : [];
    const agentById = new Map(agents.map((agent) => [agent.id, agent]));
    const assignee = conversation.assignedAgentId
      ? agentById.get(conversation.assignedAgentId)
      : undefined;
    const lead = conversation.leads[0];

    return {
      config,
      payload: {
        event: "conversation.upserted",
        eventId: data.eventId,
        occurredAt: data.occurredAt,
        conversation: {
          id: conversation.id,
          title: conversation.customer?.name ?? null,
          channel: conversation.channel.toLowerCase(),
          visitor: {
            name: conversation.customer?.name ?? null,
            email: conversation.customer?.email ?? null,
          },
          ...(assignee
            ? {
                assignee: assignee.claraUserId
                  ? { claraUserId: assignee.claraUserId }
                  : { liveChatUserId: assignee.id },
              }
            : {}),
          ...(lead
            ? {
                lead: {
                  phone: lead.phone,
                  city: lead.city,
                  purpose: lead.purpose,
                  productInterest: lead.productInterest,
                  consentGiven: lead.consentGiven,
                },
              }
            : {}),
          messages: messages.map((message) => {
            const agent = message.senderId
              ? agentById.get(message.senderId)
              : undefined;
            const senderType =
              message.senderType === SenderType.AGENT
                ? "sales"
                : message.senderType === SenderType.AI
                  ? "ai"
                  : "customer";
            const attachmentText = message.attachments
              .map((attachment) => `[Attachment: ${attachment.fileName}]`)
              .join("\n");
            const text = [
              message.contentSanitized ?? message.content,
              attachmentText,
            ]
              .filter(Boolean)
              .join("\n")
              .slice(0, MAX_TEXT_LENGTH);
            return {
              id: message.id,
              senderType,
              senderName:
                senderType === "ai"
                  ? "SOLIDAi"
                  : senderType === "sales"
                    ? (agent?.name ?? "Sales")
                    : (conversation.customer?.name ?? "Customer"),
              ...(senderType === "sales" && agent?.claraUserId
                ? { senderClaraUserId: agent.claraUserId }
                : {}),
              text: text || "[Pesan tanpa teks]",
              sentAt: message.createdAt.toISOString(),
            };
          }),
        },
      },
    };
  }
}
