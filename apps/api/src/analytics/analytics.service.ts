import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

export interface AnalyticsFilter {
  organizationId: string;
  siteId?: string;
  from?: Date;
  to?: Date;
}

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  private range(filter: AnalyticsFilter) {
    const to = filter.to ?? new Date();
    const from = filter.from ?? new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
    return { gte: from, lte: to };
  }

  async overview(filter: AnalyticsFilter) {
    const createdAt = this.range(filter);
    const where = { organizationId: filter.organizationId, siteId: filter.siteId || undefined, createdAt };

    const [total, aiHandled, handoff, resolved, tickets, leads] = await Promise.all([
      this.prisma.conversation.count({ where }),
      this.prisma.conversation.count({ where: { ...where, handlerType: "AI" } }),
      this.prisma.conversation.count({ where: { ...where, handoffReason: { not: null } } }),
      this.prisma.conversation.count({ where: { ...where, status: "RESOLVED" } }),
      this.prisma.ticket.count({ where: { organizationId: filter.organizationId, createdAt } }),
      this.prisma.lead.count({ where: { organizationId: filter.organizationId, createdAt } }),
    ]);

    return {
      totalConversations: total,
      aiContainmentRate: total > 0 ? aiHandled / total : 0,
      handoffRate: total > 0 ? handoff / total : 0,
      resolvedRate: total > 0 ? resolved / total : 0,
      ticketCount: tickets,
      leadCount: leads,
    };
  }

  async conversationsVolume(filter: AnalyticsFilter) {
    const createdAt = this.range(filter);
    const conversations = await this.prisma.conversation.findMany({
      where: { organizationId: filter.organizationId, siteId: filter.siteId || undefined, createdAt },
      select: { createdAt: true },
    });
    const byDay = new Map<string, number>();
    for (const c of conversations) {
      const key = c.createdAt.toISOString().slice(0, 10);
      byDay.set(key, (byDay.get(key) ?? 0) + 1);
    }
    return [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, count]) => ({ date, count }));
  }

  async agentsPerformance(organizationId: string) {
    const agents = await this.prisma.user.findMany({
      where: { organizationId, agentProfile: { isNot: null } },
      include: { agentProfile: true },
    });
    const results = [];
    for (const agent of agents) {
      const [handled, resolved] = await Promise.all([
        this.prisma.conversation.count({ where: { assignedAgentId: agent.id } }),
        this.prisma.conversation.count({ where: { assignedAgentId: agent.id, status: "RESOLVED" } }),
      ]);
      results.push({
        agentId: agent.id,
        name: agent.name,
        availability: agent.agentProfile?.availability,
        activeChatCount: agent.agentProfile?.activeChatCount,
        totalHandled: handled,
        totalResolved: resolved,
      });
    }
    return results;
  }

  async aiPerformance(filter: AnalyticsFilter) {
    const createdAt = this.range(filter);
    const runs = await this.prisma.aiRun.findMany({
      where: { purpose: "ANSWER", createdAt, conversation: { organizationId: filter.organizationId, siteId: filter.siteId || undefined } },
    });
    const avgConfidence = runs.length > 0 ? runs.reduce((sum, r) => sum + (r.confidence ?? 0), 0) / runs.length : 0;
    const avgLatencyMs = runs.length > 0 ? runs.reduce((sum, r) => sum + (r.latencyMs ?? 0), 0) / runs.length : 0;
    return { totalAnswers: runs.length, avgConfidence, avgLatencyMs, handoffCount: runs.filter((r) => r.handoffRequired).length };
  }

  async topIntents(filter: AnalyticsFilter) {
    const createdAt = this.range(filter);
    const conversations = await this.prisma.conversation.findMany({
      where: { organizationId: filter.organizationId, siteId: filter.siteId || undefined, createdAt, intent: { not: null } },
      select: { intent: true },
    });
    const counts = new Map<string, number>();
    for (const c of conversations) counts.set(c.intent!, (counts.get(c.intent!) ?? 0) + 1);
    return [...counts.entries()].sort(([, a], [, b]) => b - a).map(([intent, count]) => ({ intent, count }));
  }

  /** "Top unanswered questions" (§11): conversations whose last AI answer fell below threshold. */
  async knowledgeGaps(filter: AnalyticsFilter) {
    const createdAt = this.range(filter);
    const lowConfidenceRuns = await this.prisma.aiRun.findMany({
      where: {
        purpose: "ANSWER",
        handoffRequired: true,
        createdAt,
        conversation: { organizationId: filter.organizationId, siteId: filter.siteId || undefined },
      },
      include: { messages: true },
      take: 100,
    });
    return lowConfidenceRuns.map((run) => ({
      aiRunId: run.id,
      conversationId: run.conversationId,
      intent: run.intent,
      confidence: run.confidence,
      createdAt: run.createdAt,
    }));
  }

  async customerSatisfaction(filter: AnalyticsFilter) {
    const createdAt = this.range(filter);
    const feedbacks = await this.prisma.customerFeedback.findMany({
      where: { createdAt, conversation: { organizationId: filter.organizationId, siteId: filter.siteId || undefined } },
    });
    const avg = feedbacks.length > 0 ? feedbacks.reduce((sum, f) => sum + f.score, 0) / feedbacks.length : null;
    return { totalRatings: feedbacks.length, averageScore: avg };
  }
}
