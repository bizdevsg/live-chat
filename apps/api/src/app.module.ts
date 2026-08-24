import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { APP_FILTER, APP_GUARD } from "@nestjs/core";
import { ThrottlerModule } from "@nestjs/throttler";
import { AppThrottlerGuard } from "./common/guards/app-throttler.guard";
import { BullModule } from "@nestjs/bullmq";
import { validateEnv } from "./config/env.validation";
import { PrismaModule } from "./prisma/prisma.module";
import { RedisModule } from "./redis/redis.module";
import { CommonModule } from "./common/common.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { RealtimeCoreModule } from "./realtime/realtime-core.module";
import { StorageModule } from "./storage/storage.module";
import { AiProviderModule } from "./ai/ai-provider.module";
import { RequestIdMiddleware } from "./common/middleware/request-id.middleware";
import { JwtAuthGuard } from "./common/guards/jwt-auth.guard";
import { ApiExceptionFilter } from "./common/filters/api-exception.filter";
import { AuthModule } from "./auth/auth.module";
import { WidgetModule } from "./widget/widget.module";
import { RealtimeModule } from "./realtime/realtime.module";
import { AgentModule } from "./agent/agent.module";
import { AdminModule } from "./admin/admin.module";
import { KnowledgeModule } from "./knowledge/knowledge.module";
import { AiModule } from "./ai/ai.module";
import { TicketsModule } from "./tickets/tickets.module";
import { LeadsModule } from "./leads/leads.module";
import { AnalyticsModule } from "./analytics/analytics.module";
import { HealthModule } from "./health/health.module";
import { MarketDataModule } from "./market-data/market-data.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    JwtModule.register({}),
    ThrottlerModule.forRoot({ throttlers: [{ ttl: 60_000, limit: 120 }] }),
    BullModule.forRootAsync({
      useFactory: () => ({
        connection: {
          host: process.env.REDIS_HOST ?? "localhost",
          port: Number(process.env.REDIS_PORT ?? 6379),
          password: process.env.REDIS_PASSWORD || undefined,
        },
      }),
    }),
    PrismaModule,
    RedisModule,
    CommonModule,
    NotificationsModule,
    RealtimeCoreModule,
    StorageModule,
    AiProviderModule,
    AuthModule,
    WidgetModule,
    RealtimeModule,
    AgentModule,
    AdminModule,
    KnowledgeModule,
    AiModule,
    MarketDataModule,
    TicketsModule,
    LeadsModule,
    AnalyticsModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: AppThrottlerGuard },
    { provide: APP_FILTER, useClass: ApiExceptionFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes("*");
  }
}
