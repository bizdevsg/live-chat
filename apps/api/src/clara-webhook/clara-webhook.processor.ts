import { Processor, WorkerHost } from "@nestjs/bullmq";
import type { Job } from "bullmq";
import {
  CLARA_WEBHOOK_QUEUE,
  ClaraWebhookService,
  PermanentClaraWebhookError,
  RetryableClaraWebhookError,
  type ClaraWebhookJobData,
} from "./clara-webhook.service";

@Processor(CLARA_WEBHOOK_QUEUE, {
  concurrency: 5,
  // Clara's contract is 120 requests/minute per site+IP. A queue-wide ceiling is slightly more
  // conservative for multi-site deployments and guarantees a single API instance never exceeds it.
  limiter: { max: 120, duration: 60_000 },
  settings: {
    backoffStrategy: (attemptsMade: number, type?: string, error?: Error) => {
      if (error instanceof RetryableClaraWebhookError && error.retryAfterMs)
        return Math.min(error.retryAfterMs, 900_000);
      return type === "clara-exponential"
        ? Math.min(5_000 * 2 ** Math.max(0, attemptsMade - 1), 900_000)
        : 5_000;
    },
  },
})
export class ClaraWebhookProcessor extends WorkerHost {
  constructor(private readonly webhooks: ClaraWebhookService) {
    super();
  }

  async process(job: Job<ClaraWebhookJobData>): Promise<void> {
    try {
      await this.webhooks.deliver(job.data);
    } catch (error) {
      if (error instanceof PermanentClaraWebhookError) await job.discard();
      throw error;
    }
  }
}
