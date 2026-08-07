import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { BullModule } from "@nestjs/bullmq";
import { QUEUE_NAMES } from "@solidchat/shared";
import { PrismaService } from "./prisma.service";
import { EncryptionService } from "./encryption.service";
import { CrmSyncProcessor } from "./crm/crm-sync.processor";
import { AnalyticsAggregationProcessor } from "./analytics/analytics-aggregation.processor";
import { CleanupProcessor } from "./cleanup/cleanup.processor";
import { SchedulerService } from "./scheduler.service";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    BullModule.forRootAsync({
      useFactory: () => ({
        connection: {
          host: process.env.REDIS_HOST ?? "localhost",
          port: Number(process.env.REDIS_PORT ?? 6379),
          password: process.env.REDIS_PASSWORD || undefined,
        },
      }),
    }),
    BullModule.registerQueue(
      { name: QUEUE_NAMES.CRM_SYNC },
      { name: QUEUE_NAMES.ANALYTICS_AGGREGATION },
      { name: QUEUE_NAMES.CLEANUP },
    ),
  ],
  providers: [PrismaService, EncryptionService, CrmSyncProcessor, AnalyticsAggregationProcessor, CleanupProcessor, SchedulerService],
})
export class AppModule {}
