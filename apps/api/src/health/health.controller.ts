import { Controller, Get, Inject } from "@nestjs/common";
import { HealthCheck, HealthCheckService, PrismaHealthIndicator } from "@nestjs/terminus";
import type Redis from "ioredis";
import { Public } from "../common/decorators/public.decorator";
import { PrismaService } from "../prisma/prisma.service";
import { REDIS_CLIENT } from "../redis/redis.module";

@Public()
@Controller("health")
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prismaHealth: PrismaHealthIndicator,
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([() => this.prismaHealth.pingCheck("mysql", this.prisma)]);
  }

  @Get("live")
  live() {
    return { status: "ok" };
  }

  @Get("ready")
  @HealthCheck()
  ready() {
    return this.health.check([
      () => this.prismaHealth.pingCheck("mysql", this.prisma),
      async () => {
        const pong = await this.redis.ping();
        return { redis: { status: pong === "PONG" ? "up" : "down" } };
      },
    ]);
  }
}
