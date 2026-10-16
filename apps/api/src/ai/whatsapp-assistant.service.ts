import { HttpStatus, Injectable } from "@nestjs/common";
import { extractCustomerServiceQuery } from "@solidchat/ai-core";
import {
  AiIntent,
  DEFAULT_CONFIDENCE_THRESHOLD,
  ErrorCode,
  type ChatTurn,
} from "@solidchat/shared";
import { ApiException, NotFoundApiException } from "../common/errors/api.exception";
import { RetrievalService } from "../knowledge/retrieval.service";
import { PrismaService } from "../prisma/prisma.service";
import { AiProviderFactory } from "./ai-provider.factory";
import type { WhatsAppAssistantReplyDto } from "./dto/ai.dto";
import { AiRunRecorderService } from "../common/ai-run-recorder.service";
import { WhatsAppAssistantPromptService } from "./whatsapp-assistant-prompt.service";

const AUTO_REPLY_BLOCKED_INTENTS = new Set<string>([
  AiIntent.DEPOSIT,
  AiIntent.WITHDRAWAL,
  AiIntent.SECURITY,
  AiIntent.COMPLAINT,
  AiIntent.HUMAN_REQUEST,
  AiIntent.SENSITIVE_DATA,
]);

export function buildWhatsAppKnowledgeQuery(
  focusedQuery: string,
  agentPrompt: string,
  history: ChatTurn[],
): string {
  const recentConversation = history
    .slice(-6)
    .map((turn) => `${turn.senderType}: ${turn.content.slice(0, 600)}`)
    .join("\n");

  return [
    `Topik utama: ${focusedQuery.trim()}`,
    agentPrompt.trim() ? `Kebutuhan agent: ${agentPrompt.trim().slice(0, 1000)}` : "",
    recentConversation ? `Konteks percakapan terbaru:\n${recentConversation}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

@Injectable()
export class WhatsAppAssistantService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly retrieval: RetrievalService,
    private readonly aiProviderFactory: AiProviderFactory,
    private readonly aiRuns: AiRunRecorderService,
    private readonly assistantPrompt: WhatsAppAssistantPromptService,
  ) {}

  async createReply(dto: WhatsAppAssistantReplyDto, configuredSiteId?: string) {
    const requestedSiteId = dto.siteId?.trim() || configuredSiteId?.trim();
    const site = await this.prisma.site.findFirst({
      where: {
        ...(requestedSiteId
          ? { OR: [{ id: requestedSiteId }, { siteKey: requestedSiteId }] }
          : {}),
      },
      include: { organization: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
    });
    if (!site) {
      throw new NotFoundApiException(ErrorCode.SITE_NOT_FOUND, "Site tidak ditemukan untuk organisasi ini.");
    }

    const history: ChatTurn[] = dto.messages.map((message, index) => ({
      senderType: message.senderType,
      content: message.content.trim(),
      createdAt: message.createdAt ?? new Date(Date.now() + index).toISOString(),
    }));
    const lastCustomerMessage = [...history].reverse().find((message) => message.senderType === "CUSTOMER");
    if (!lastCustomerMessage) {
      throw new ApiException(
        ErrorCode.VALIDATION_ERROR,
        "Pesan customer belum ditemukan pada chat aktif.",
        HttpStatus.BAD_REQUEST,
      );
    }

    const { provider, model } = await this.aiProviderFactory.getProviderForSite(site.id);
    const tracking = {
      organizationId: site.organizationId,
      siteId: site.id,
      source: "EXTENSION" as const,
    };
    const classifyStart = Date.now();
    const classification = await provider.classifyIntent({
      message: lastCustomerMessage.content,
      history,
      language: site.language,
    });
    await this.aiRuns.record({
      ...tracking,
      purpose: "CLASSIFY",
      provider: provider.name,
      model,
      latencyMs: Date.now() - classifyStart,
      confidence: classification.confidence,
      intent: classification.intent,
      ...provider.consumeTokenUsage?.(),
    });
    const focusedRetrievalQuery =
      classification.retrievalQuery?.trim() ||
      extractCustomerServiceQuery(lastCustomerMessage.content, classification.intent);
    const retrievalQuery = buildWhatsAppKnowledgeQuery(focusedRetrievalQuery, dto.prompt, history);

    const evidence = await this.retrieval.retrieveForAgent(site.id, retrievalQuery, tracking);

    const replyStart = Date.now();
    const result = await provider.generateSuggestedReply({
      history,
      language: site.language,
      evidence,
      aiName: site.aiName,
      agentName: "Tim Customer Service",
      organizationName: site.organization.name,
      systemPrompt: this.assistantPrompt.getPrompt(),
      agentDraft: dto.prompt,
    });
    await this.aiRuns.record({
      ...tracking,
      purpose: "SUGGESTED_REPLY",
      provider: provider.name,
      model,
      latencyMs: Date.now() - replyStart,
      confidence: result.confidence,
      intent: classification.intent,
      ...provider.consumeTokenUsage?.(),
    });

    const autoReplyBlockedReason = classification.promptInjectionDetected
      ? "PROMPT_INJECTION_DETECTED"
      : classification.containsSensitiveData
        ? "SENSITIVE_DATA_DETECTED"
        : AUTO_REPLY_BLOCKED_INTENTS.has(classification.intent)
          ? `INTENT_${classification.intent}`
          : classification.sentiment === "ANGRY"
            ? "ANGRY_CUSTOMER"
            : result.confidence < DEFAULT_CONFIDENCE_THRESHOLD
              ? "LOW_CONFIDENCE"
              : !result.reply.trim()
                ? "EMPTY_REPLY"
                : null;

    return {
      reply: result.reply,
      confidence: result.confidence,
      sources: result.sources,
      classification: {
        intent: classification.intent,
        sentiment: classification.sentiment,
        containsSensitiveData: classification.containsSensitiveData,
      },
      canAutoReply: autoReplyBlockedReason === null,
      autoReplyBlockedReason,
      site: { id: site.id, name: site.name },
    };
  }
}
