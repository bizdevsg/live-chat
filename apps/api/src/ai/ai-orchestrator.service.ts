import { Injectable } from "@nestjs/common";
import { extractCustomerServiceQuery } from "@solidchat/ai-core";
import {
  DEFAULT_CONFIDENCE_THRESHOLD,
  ErrorCode,
  HandlerType,
  HandoffReason,
  MessageType,
  SenderType,
  type AnswerResult,
  type ChatTurn,
} from "@solidchat/shared";
import { PrismaService } from "../prisma/prisma.service";
import { ConversationsService } from "../conversations/conversations.service";
import { RetrievalService } from "../knowledge/retrieval.service";
import { AiProviderFactory } from "./ai-provider.factory";
import { HandoffEvaluatorService } from "./handoff-evaluator.service";
import { SecurityEventService } from "../common/security/security-event.service";
import { RealtimeEmitterService } from "../realtime/realtime-emitter.service";
import { MarketDataService } from "../market-data/market-data.service";
import { ApiException } from "../common/errors/api.exception";

@Injectable()
export class AiOrchestratorService {
  /** Guards against double-answering when a visitor fires several messages in quick succession. */
  private readonly inFlightTurns = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly conversations: ConversationsService,
    private readonly retrieval: RetrievalService,
    private readonly aiProviderFactory: AiProviderFactory,
    private readonly handoffEvaluator: HandoffEvaluatorService,
    private readonly securityEvents: SecurityEventService,
    private readonly realtime: RealtimeEmitterService,
    private readonly marketData: MarketDataService,
  ) {}

  /**
   * Runs the full §16 pipeline for the visitor's latest message. Called right after
   * ConversationsService.postMessage. The AI responds immediately — there is no initial
   * delay; visitors who want a human use the "Hubungi Agent" button or are handed off
   * automatically when the AI cannot answer confidently.
   */
  async scheduleVisitorTurn(conversationId: string): Promise<void> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { status: true, handlerType: true },
    });
    if (!conversation || conversation.status === "CLOSED" || conversation.status === "RESOLVED" || conversation.handlerType !== HandlerType.AI) {
      return;
    }

    await this.processVisitorTurn(conversationId);
  }

  async processVisitorTurn(conversationId: string): Promise<void> {
    // Serialize turns per conversation so a visitor firing several messages in quick
    // succession never triggers overlapping AI answers.
    if (this.inFlightTurns.has(conversationId)) return;
    this.inFlightTurns.add(conversationId);
    try {
      await this.runVisitorTurn(conversationId);
    } finally {
      this.inFlightTurns.delete(conversationId);
    }

    // If the visitor sent another message while the AI was answering, handle it now.
    if (await this.conversations.hasPendingVisitorMessageSince(conversationId, new Date(0))) {
      await this.processVisitorTurn(conversationId);
    }
  }

  async previewKnowledgeAnswer(organizationId: string, message: string) {
    const site = await this.prisma.site.findFirst({
      where: { organizationId },
      include: {
        organization: { select: { name: true } },
        settings: { select: { showAiSourcesToCustomer: true } },
      },
      orderBy: { createdAt: "asc" },
    });
    if (!site) {
      throw new ApiException(ErrorCode.SITE_NOT_FOUND, "Site tidak ditemukan untuk organization ini.");
    }

    const trimmedMessage = message.trim();
    const history: ChatTurn[] = [];
    const { provider, config } = await this.aiProviderFactory.getProviderForSite(site.id);
    const classification = await provider.classifyIntent({
      message: trimmedMessage,
      history,
      language: site.language,
    });
    const forcedHandoffReason = this.handoffEvaluator.evaluate(trimmedMessage, classification);
    const retrievalQuery = extractCustomerServiceQuery(trimmedMessage, classification.intent);
    const [marketEvidence, knowledgeEvidence, answerPrompt] = await Promise.all([
      Promise.resolve(this.marketData.getRealtimePriceEvidence(trimmedMessage)),
      this.retrieval.retrieveForCustomer(site.id, retrievalQuery),
      this.prisma.aiPrompt.findFirst({
        where: {
          aiConfigurationId: config.id,
          purpose: "ANSWER",
          isActive: true,
        },
        orderBy: { version: "desc" },
      }),
    ]);
    const evidence = [...marketEvidence, ...knowledgeEvidence];
    const realtimePriceAnswer = this.marketData.getRealtimePriceAnswer(trimmedMessage);
    const answer = forcedHandoffReason
      ? null
      : realtimePriceAnswer
        ? {
            answer: realtimePriceAnswer,
            confidence: 0.98,
            intent: classification.intent,
            handoffRequired: false,
            sources: marketEvidence.map((item) => ({
              documentId: item.documentId,
              chunkId: item.chunkId,
              title: item.title,
              version: item.version,
              score: 0.98,
            })),
          }
      : await provider.generateAnswer({
          message: trimmedMessage,
          history,
          language: site.language,
          intent: classification.intent,
          evidence,
          aiName: site.aiName,
          organizationName: site.organization.name,
          systemPrompt: answerPrompt?.content ?? null,
        });

    return {
      site: {
        id: site.id,
        name: site.name,
        aiName: site.aiName,
        language: site.language,
        organizationName: site.organization.name,
      },
      classification,
      retrievalQuery,
      forcedHandoffReason,
      evidence: evidence.map((item, index) => ({
        index: index + 1,
        sourceType: item.chunkId.startsWith("market-quote:") ? "MARKET" : "KNOWLEDGE",
        documentId: item.documentId,
        chunkId: item.chunkId,
        title: item.title,
        version: item.version,
        audience: item.audience,
        content: item.content,
      })),
      answer: answer
        ? {
            ...answer,
            formattedAnswer: this.formatAnswerForCustomer(
              answer.answer,
              answer.sources,
              site.settings?.showAiSourcesToCustomer ?? false,
            ),
            lowConfidence: answer.confidence < DEFAULT_CONFIDENCE_THRESHOLD,
            // The answer generator's uncertainty flag is not a transfer decision. In production,
            // only the earlier structured handoff decision can move a conversation to an agent.
            wouldAutoHandoff: false,
          }
        : null,
    };
  }

  private async runVisitorTurn(conversationId: string): Promise<void> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { customer: { select: { name: true } } },
    });
    if (!conversation || conversation.handlerType !== HandlerType.AI) return;

    const site = await this.prisma.site.findUnique({ where: { id: conversation.siteId }, include: { settings: true } });
    if (!site?.settings?.aiEnabled) return;

    const messages = await this.prisma.message.findMany({
      where: { conversationId, deletedAt: null, isInternal: false },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    const ordered = messages.reverse();
    const lastVisitorMessage = [...ordered].reverse().find((m) => m.senderType === SenderType.VISITOR || m.senderType === SenderType.CUSTOMER);
    if (!lastVisitorMessage) return;

    const history: ChatTurn[] = ordered.map((m) => ({
      senderType: m.senderType as ChatTurn["senderType"],
      content: m.content,
      createdAt: m.createdAt.toISOString(),
    }));

    // Drives the "AI sedang mengetik…" indicator in the widget/dashboard — reuses the same
    // typing:updated event agents use, just with from: "AI". Always cleared in `finally` so a
    // thrown/handed-off turn never leaves the indicator stuck on for the visitor.
    this.realtime.toConversation(conversationId, "typing:updated", { from: "AI", typing: true });
    try {
      const { provider, config } = await this.aiProviderFactory.getProviderForSite(conversation.siteId);

      const classifyStart = Date.now();
      const classification = await provider.classifyIntent({
        message: lastVisitorMessage.content,
        history,
        language: conversation.language,
      });
      await this.recordAiRun(conversationId, "CLASSIFY", provider.name, config.model, {
        latencyMs: Date.now() - classifyStart,
        confidence: classification.confidence,
        intent: classification.intent,
      });

      if (!conversation.intent) {
        await this.prisma.conversation.update({ where: { id: conversationId }, data: { intent: classification.intent, sentiment: classification.sentiment } });
      }

      if (classification.promptInjectionDetected) {
        await this.securityEvents.record({
          organizationId: conversation.organizationId,
          type: "PROMPT_INJECTION_DETECTED",
          severity: "MEDIUM",
          details: { conversationId },
        });
      }

      const forcedReason = this.handoffEvaluator.evaluate(lastVisitorMessage.content, classification);
      if (forcedReason) {
        await this.respondBeforeHandoff(conversationId, forcedReason);
        return;
      }

      const handoffDecision = await provider.decideHandoff({
        message: lastVisitorMessage.content,
        history,
        language: conversation.language,
      });
      if (handoffDecision.action !== "NONE") {
        await this.conversations.postMessage({
          conversationId,
          senderType: SenderType.AI,
          content: handoffDecision.reply,
          messageType: MessageType.TEXT,
          metadata: { handoffDecision: handoffDecision.action },
        });
        if (handoffDecision.action === "TRANSFER") {
          await this.conversations.requestAgent(conversationId, HandoffReason.CUSTOMER_REQUESTED_HUMAN);
          await this.summarize(conversationId, "HANDOFF");
        }
        return;
      }

      // A natural follow-up such as "kalau top up 800 dolar jadi berapa?" often omits the
      // rate/formula that was established one turn earlier. Include recent conversational context
      // in retrieval so the model receives the authoritative KB chunk again; history itself still
      // never becomes a factual source for the final answer.
      const retrievalQuery = [
        extractCustomerServiceQuery(lastVisitorMessage.content, classification.intent),
        ...history.slice(-6).map((turn) => turn.content),
      ]
        .filter(Boolean)
        .join("\n");
      const [marketEvidence, knowledgeEvidence] = await Promise.all([
        Promise.resolve(this.marketData.getRealtimePriceEvidence(lastVisitorMessage.content, history.map((turn) => turn.content).join("\n"))),
        this.retrieval.retrieveForCustomer(conversation.siteId, retrievalQuery),
      ]);
      const evidence = [...marketEvidence, ...knowledgeEvidence];
      const realtimePriceAnswer = this.marketData.getRealtimePriceAnswer(
        lastVisitorMessage.content,
        history.map((turn) => turn.content).join("\n"),
      );
      const answerPrompt = await this.prisma.aiPrompt.findFirst({
        where: {
          aiConfigurationId: config.id,
          purpose: "ANSWER",
          isActive: true,
        },
        orderBy: { version: "desc" },
      });

      const answerStart = Date.now();
      const answer = realtimePriceAnswer
        ? {
            answer: realtimePriceAnswer,
            confidence: 0.98,
            intent: classification.intent,
            handoffRequired: false,
            sources: marketEvidence.map((item) => ({
              documentId: item.documentId,
              chunkId: item.chunkId,
              title: item.title,
              version: item.version,
              score: 0.98,
            })),
          }
        : await provider.generateAnswer({
            message: lastVisitorMessage.content,
            history,
            language: conversation.language,
            intent: classification.intent,
            evidence,
            aiName: site.aiName,
            customerName: conversation.customer?.name,
            organizationName: "PT Solid Gold Berjangka",
            systemPrompt: answerPrompt?.content ?? null,
          });
      const aiRun = await this.recordAiRun(conversationId, "ANSWER", provider.name, config.model, {
        latencyMs: Date.now() - answerStart,
        confidence: answer.confidence,
        intent: answer.intent,
        // A regular answer must never create a queue handoff by itself. Human transfer has
        // already been decided above by the dedicated structured handoff decision (`TRANSFER`).
        // `generateAnswer` may still mark a reply as uncertain for wording/audit purposes, but
        // that is not consent from the customer and must not switch the handler to HUMAN.
        handoffRequired: false,
      });

      await this.conversations.postMessage({
        conversationId,
        senderType: SenderType.AI,
        content: this.formatAnswerForCustomer(answer.answer, answer.sources, site.settings.showAiSourcesToCustomer),
        messageType: MessageType.TEXT,
        aiRunId: aiRun.id,
        metadata: { confidence: answer.confidence, intent: answer.intent, sources: answer.sources },
      });

    } finally {
      this.realtime.toConversation(conversationId, "typing:updated", { from: "AI", typing: false });
    }
  }

  private async respondBeforeHandoff(conversationId: string, reason: HandoffReason) {
    await this.conversations.postMessage({
      conversationId,
      senderType: SenderType.AI,
      content:
        "Baik, untuk hal ini saya akan menghubungkan Anda dengan petugas kami agar dapat dibantu lebih lanjut. Mohon tunggu sebentar ya.",
      messageType: MessageType.TEXT,
    });
    await this.conversations.requestAgent(conversationId, reason);
    await this.summarize(conversationId, "HANDOFF");
  }

  private formatAnswerForCustomer(answer: string, sources: { title: string }[], showSources: boolean): string {
    if (!showSources || sources.length === 0) return answer;
    const list = sources.map((s) => `• ${s.title}`).join("\n");
    return `${answer}\n\nSumber:\n${list}`;
  }

  async summarize(conversationId: string, trigger: "HANDOFF" | "RESOLVED" | "LENGTH" | "MANUAL") {
    const conversation = await this.prisma.conversation.findUnique({ where: { id: conversationId } });
    if (!conversation) return null;

    const messages = await this.prisma.message.findMany({ where: { conversationId, deletedAt: null }, orderBy: { createdAt: "asc" } });
    const history: ChatTurn[] = messages.map((m) => ({
      senderType: m.senderType as ChatTurn["senderType"],
      content: m.content,
      createdAt: m.createdAt.toISOString(),
    }));

    const { provider, config } = await this.aiProviderFactory.getProviderForSite(conversation.siteId);
    const start = Date.now();
    const summary = await provider.summarizeConversation({ history, language: conversation.language });
    await this.recordAiRun(conversationId, "SUMMARY", provider.name, config.model, { latencyMs: Date.now() - start });

    return this.prisma.conversationSummary.create({
      data: {
        conversationId,
        customerGoal: summary.customerGoal,
        importantFacts: summary.importantFacts,
        actionsTaken: summary.actionsTaken,
        openIssues: summary.openIssues,
        sensitiveDataDetected: summary.sensitiveDataDetected,
        trigger,
      },
    });
  }

  async generateSuggestedReplyForAgent(conversationId: string, agentId: string) {
    const conversation = await this.prisma.conversation.findUnique({ where: { id: conversationId } });
    if (!conversation) return null;

    const messages = await this.prisma.message.findMany({ where: { conversationId, deletedAt: null }, orderBy: { createdAt: "asc" } });
    const history: ChatTurn[] = messages.map((m) => ({
      senderType: m.senderType as ChatTurn["senderType"],
      content: m.content,
      createdAt: m.createdAt.toISOString(),
    }));
    const lastVisitorMessage = [...messages].reverse().find((m) => m.senderType === SenderType.VISITOR || m.senderType === SenderType.CUSTOMER);

    const { provider, config } = await this.aiProviderFactory.getProviderForSite(conversation.siteId);
    const [evidence, answerPrompt, site, agent] = await Promise.all([
      lastVisitorMessage ? this.retrieval.retrieveForAgent(conversation.siteId, lastVisitorMessage.content) : Promise.resolve([]),
      this.prisma.aiPrompt.findFirst({
        where: { aiConfigurationId: config.id, purpose: "ANSWER", isActive: true },
        orderBy: { version: "desc" },
      }),
      this.prisma.site.findUnique({ where: { id: conversation.siteId }, select: { aiName: true } }),
      this.prisma.user.findUnique({ where: { id: agentId }, select: { name: true } }),
    ]);

    const start = Date.now();
    const result = await provider.generateSuggestedReply({
      history,
      language: conversation.language,
      evidence,
      aiName: site?.aiName ?? "Asisten Virtual",
      agentName: agent?.name?.trim() || "Tim Customer Service",
      organizationName: "PT Solid Gold Berjangka",
      systemPrompt: answerPrompt?.content ?? null,
    });
    const aiRun = await this.recordAiRun(conversationId, "SUGGESTED_REPLY", provider.name, config.model, {
      latencyMs: Date.now() - start,
      confidence: result.confidence,
    });

    return { aiRunId: aiRun.id, reply: result.reply, sources: result.sources, confidence: result.confidence };
  }

  async submitFeedback(aiRunId: string, agentId: string, helpful: boolean, used: boolean, edited: boolean) {
    return this.prisma.aiFeedback.create({ data: { aiRunId, agentId, helpful, used, edited } });
  }

  private async recordAiRun(
    conversationId: string,
    purpose: "CLASSIFY" | "ANSWER" | "SUMMARY" | "SUGGESTED_REPLY" | "EMBEDDING",
    provider: string,
    model: string,
    extra: { latencyMs?: number; confidence?: number; intent?: string; handoffRequired?: boolean; status?: "SUCCESS" | "ERROR" | "TIMEOUT" },
  ) {
    return this.prisma.aiRun.create({
      data: {
        conversationId,
        purpose,
        provider,
        model,
        status: extra.status ?? "SUCCESS",
        latencyMs: extra.latencyMs,
        confidence: extra.confidence,
        intent: extra.intent,
        handoffRequired: extra.handoffRequired,
      },
    });
  }
}
