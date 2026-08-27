import { Injectable, Logger } from "@nestjs/common";
import { extractCustomerServiceQuery } from "@solidchat/ai-core";
import { DEFAULT_CONFIDENCE_THRESHOLD, HandlerType, HandoffReason, MessageType, SenderType, type ChatTurn } from "@solidchat/shared";
import { PrismaService } from "../prisma/prisma.service";
import { ConversationsService } from "../conversations/conversations.service";
import { RetrievalService } from "../knowledge/retrieval.service";
import { AiProviderFactory } from "./ai-provider.factory";
import { HandoffEvaluatorService } from "./handoff-evaluator.service";
import { SecurityEventService } from "../common/security/security-event.service";
import { RealtimeEmitterService } from "../realtime/realtime-emitter.service";
import { MarketDataService } from "../market-data/market-data.service";

@Injectable()
export class AiOrchestratorService {
  private readonly logger = new Logger(AiOrchestratorService.name);
  private readonly initialResponseDelayMs = 10_000;
  private readonly pendingInitialResponses = new Map<string, NodeJS.Timeout>();

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

  /** Runs the full §16 pipeline for the visitor's latest message. Called right after ConversationsService.postMessage. */
  async scheduleVisitorTurn(conversationId: string): Promise<void> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { id: true, status: true, handlerType: true },
    });
    if (!conversation || conversation.status === "CLOSED" || conversation.status === "RESOLVED" || conversation.handlerType !== HandlerType.AI) {
      this.clearPendingInitialResponse(conversationId);
      return;
    }

    const publicMessages = await this.prisma.message.findMany({
      where: {
        conversationId,
        deletedAt: null,
        isInternal: false,
        senderType: { in: [SenderType.VISITOR, SenderType.CUSTOMER, SenderType.AI, SenderType.AGENT] },
      },
      orderBy: { createdAt: "asc" },
      select: { senderType: true, createdAt: true },
    });

    const firstVisitorMessage = publicMessages.find((message) => message.senderType === SenderType.VISITOR || message.senderType === SenderType.CUSTOMER);
    if (!firstVisitorMessage) return;

    const hasResponderMessage = publicMessages.some(
      (message) =>
        message.createdAt > firstVisitorMessage.createdAt &&
        (message.senderType === SenderType.AI || message.senderType === SenderType.AGENT),
    );

    if (hasResponderMessage) {
      this.clearPendingInitialResponse(conversationId);
      await this.processVisitorTurn(conversationId);
      return;
    }

    const delayMs = firstVisitorMessage.createdAt.getTime() + this.initialResponseDelayMs - Date.now();
    if (delayMs <= 0) {
      this.clearPendingInitialResponse(conversationId);
      await this.processVisitorTurn(conversationId);
      return;
    }

    if (this.pendingInitialResponses.has(conversationId)) return;

    const timeout = setTimeout(() => {
      this.pendingInitialResponses.delete(conversationId);
      this.processVisitorTurn(conversationId).catch((error) => this.logger.error(error));
    }, delayMs);
    this.pendingInitialResponses.set(conversationId, timeout);
  }

  async processVisitorTurn(conversationId: string): Promise<void> {
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

      const retrievalQuery = extractCustomerServiceQuery(lastVisitorMessage.content, classification.intent);
      const [marketEvidence, knowledgeEvidence] = await Promise.all([
        Promise.resolve(this.marketData.getRealtimePriceEvidence(lastVisitorMessage.content)),
        this.retrieval.retrieveForCustomer(conversation.siteId, retrievalQuery),
      ]);
      const evidence = [...marketEvidence, ...knowledgeEvidence];
      const answerPrompt = await this.prisma.aiPrompt.findFirst({
        where: {
          aiConfigurationId: config.id,
          purpose: "ANSWER",
          isActive: true,
        },
        orderBy: { version: "desc" },
      });

      const answerStart = Date.now();
      const answer = await provider.generateAnswer({
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
        handoffRequired: answer.handoffRequired,
      });

      await this.conversations.postMessage({
        conversationId,
        senderType: SenderType.AI,
        content: this.formatAnswerForCustomer(answer.answer, answer.sources, site.settings.showAiSourcesToCustomer),
        messageType: MessageType.TEXT,
        aiRunId: aiRun.id,
        metadata: { confidence: answer.confidence, intent: answer.intent, sources: answer.sources },
      });

      const belowThreshold = answer.confidence < DEFAULT_CONFIDENCE_THRESHOLD || answer.handoffRequired;
      if (belowThreshold) {
        const consecutiveLowConfidence = await this.hasConsecutiveLowConfidence(conversationId, DEFAULT_CONFIDENCE_THRESHOLD);
        if (consecutiveLowConfidence) {
          await this.conversations.requestAgent(conversationId, HandoffReason.AI_FAILED_TWICE);
        }
      }
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

  private async hasConsecutiveLowConfidence(conversationId: string, threshold: number): Promise<boolean> {
    const lastTwo = await this.prisma.aiRun.findMany({
      where: { conversationId, purpose: "ANSWER" },
      orderBy: { createdAt: "desc" },
      take: 2,
    });
    if (lastTwo.length < 2) return false;
    return lastTwo.every((run) => (run.confidence ?? 1) < threshold);
  }

  private formatAnswerForCustomer(answer: string, sources: { title: string }[], showSources: boolean): string {
    if (!showSources || sources.length === 0) return answer;
    const list = sources.map((s) => `• ${s.title}`).join("\n");
    return `${answer}\n\nSumber:\n${list}`;
  }

  private clearPendingInitialResponse(conversationId: string) {
    const timeout = this.pendingInitialResponses.get(conversationId);
    if (!timeout) return;
    clearTimeout(timeout);
    this.pendingInitialResponses.delete(conversationId);
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
