import { Injectable } from "@nestjs/common";
import type { AiTokenUsage } from "@solidchat/shared";
import { PrismaService } from "../prisma/prisma.service";

export type AiRunSource = "CHAT" | "KNOWLEDGE_TESTER" | "EXTENSION" | "KNOWLEDGE_REPROCESS";
export type AiRunPurpose = "CLASSIFY" | "ANSWER" | "SUMMARY" | "SUGGESTED_REPLY" | "EMBEDDING";

export interface AiRunContext {
  organizationId: string;
  siteId?: string;
  conversationId?: string;
  source: AiRunSource;
}

export interface RecordAiRunInput extends AiRunContext, Partial<AiTokenUsage> {
  purpose: AiRunPurpose;
  provider: string;
  model: string;
  latencyMs?: number;
  confidence?: number;
  intent?: string;
  handoffRequired?: boolean;
  status?: "SUCCESS" | "ERROR" | "TIMEOUT";
  errorMessage?: string;
}

@Injectable()
export class AiRunRecorderService {
  constructor(private readonly prisma: PrismaService) {}

  record(input: RecordAiRunInput) {
    return this.prisma.aiRun.create({
      data: {
        organizationId: input.organizationId,
        siteId: input.siteId,
        conversationId: input.conversationId,
        source: input.source,
        purpose: input.purpose,
        provider: input.provider,
        model: input.model,
        status: input.status ?? "SUCCESS",
        inputTokens: input.inputTokens,
        outputTokens: input.outputTokens,
        latencyMs: input.latencyMs,
        confidence: input.confidence,
        intent: input.intent,
        handoffRequired: input.handoffRequired,
        errorMessage: input.errorMessage,
      },
    });
  }
}
