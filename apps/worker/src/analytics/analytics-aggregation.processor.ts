import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { QUEUE_NAMES } from "@solidchat/shared";
import { PrismaService } from "../prisma.service";

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Rolls up the previous day's conversations into `analytics_daily` so dashboard charts don't scan raw tables (§37, §35). */
@Processor(QUEUE_NAMES.ANALYTICS_AGGREGATION)
export class AnalyticsAggregationProcessor extends WorkerHost {
  private readonly logger = new Logger(AnalyticsAggregationProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(): Promise<void> {
    const today = startOfDay(new Date());
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);

    const sites = await this.prisma.site.findMany();
    for (const site of sites) {
      const where = { siteId: site.id, createdAt: { gte: yesterday, lt: today } };

      const [conversationCount, uniqueVisitors, newCustomers, aiAnswered, aiResolved, handoffCount, unresolvedCount, leadCount, ticketCount, feedbacks] =
        await Promise.all([
          this.prisma.conversation.count({ where }),
          this.prisma.visitor.count({ where: { siteId: site.id, firstSeenAt: { gte: yesterday, lt: today } } }),
          this.prisma.customer.count({ where: { siteId: site.id, createdAt: { gte: yesterday, lt: today } } }),
          this.prisma.conversation.count({ where: { ...where, handlerType: "AI" } }),
          this.prisma.conversation.count({ where: { ...where, handlerType: "AI", status: "RESOLVED" } }),
          this.prisma.conversation.count({ where: { ...where, handoffReason: { not: null } } }),
          this.prisma.conversation.count({ where: { ...where, status: { notIn: ["RESOLVED", "CLOSED"] } } }),
          this.prisma.lead.count({ where: { siteId: site.id, createdAt: { gte: yesterday, lt: today } } }),
          this.prisma.ticket.count({ where: { siteId: site.id, createdAt: { gte: yesterday, lt: today } } }),
          this.prisma.customerFeedback.findMany({ where: { conversation: { siteId: site.id }, createdAt: { gte: yesterday, lt: today } } }),
        ]);

      const csatAvg = feedbacks.length > 0 ? feedbacks.reduce((sum, f) => sum + f.score, 0) / feedbacks.length : null;

      await this.prisma.analyticsDaily.upsert({
        where: { organizationId_siteId_date: { organizationId: site.organizationId, siteId: site.id, date: yesterday } },
        update: {
          conversationCount,
          uniqueVisitorCount: uniqueVisitors,
          newCustomerCount: newCustomers,
          aiAnsweredCount: aiAnswered,
          aiResolvedCount: aiResolved,
          handoffCount,
          unresolvedCount,
          leadCount,
          ticketCount,
          csatAvg,
        },
        create: {
          organizationId: site.organizationId,
          siteId: site.id,
          date: yesterday,
          conversationCount,
          uniqueVisitorCount: uniqueVisitors,
          newCustomerCount: newCustomers,
          aiAnsweredCount: aiAnswered,
          aiResolvedCount: aiResolved,
          handoffCount,
          unresolvedCount,
          leadCount,
          ticketCount,
          csatAvg,
        },
      });
    }

    this.logger.log(`Aggregated analytics for ${sites.length} site(s) for ${yesterday.toISOString().slice(0, 10)}`);
  }
}
