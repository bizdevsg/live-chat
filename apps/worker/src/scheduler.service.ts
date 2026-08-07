import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import type { Queue } from "bullmq";
import { QUEUE_NAMES } from "@solidchat/shared";

/** Registers the recurring background jobs listed in §37 (daily reports, retention cleanup). */
@Injectable()
export class SchedulerService implements OnModuleInit {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    @InjectQueue(QUEUE_NAMES.ANALYTICS_AGGREGATION) private readonly analyticsQueue: Queue,
    @InjectQueue(QUEUE_NAMES.CLEANUP) private readonly cleanupQueue: Queue,
  ) {}

  async onModuleInit() {
    await this.analyticsQueue.upsertJobScheduler("daily-analytics-aggregation", { pattern: "10 0 * * *" }, { name: "aggregate" });
    await this.cleanupQueue.upsertJobScheduler("hourly-cleanup", { pattern: "0 * * * *" }, { name: "cleanup" });
    this.logger.log("Scheduled recurring jobs: daily analytics aggregation (00:10), hourly cleanup.");
  }
}
