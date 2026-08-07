import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { QUEUE_NAMES } from "@solidchat/shared";
import { PrismaService } from "../prisma.service";

/** Retention housekeeping (§31, §37): expired sessions/reset tokens are pruned, not audit/financial data. */
@Processor(QUEUE_NAMES.CLEANUP)
export class CleanupProcessor extends WorkerHost {
  private readonly logger = new Logger(CleanupProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(): Promise<void> {
    const now = new Date();
    const rateLimitCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [sessions, resetTokens, invitations, rateLimitEvents] = await Promise.all([
      this.prisma.session.deleteMany({ where: { expiresAt: { lt: now } } }),
      this.prisma.passwordResetToken.deleteMany({ where: { expiresAt: { lt: now } } }),
      this.prisma.invitation.deleteMany({ where: { expiresAt: { lt: now }, acceptedAt: null } }),
      this.prisma.rateLimitEvent.deleteMany({ where: { createdAt: { lt: rateLimitCutoff } } }),
    ]);

    this.logger.log(
      `Cleanup: removed ${sessions.count} expired sessions, ${resetTokens.count} reset tokens, ${invitations.count} stale invitations, ${rateLimitEvents.count} rate-limit events.`,
    );
  }
}
