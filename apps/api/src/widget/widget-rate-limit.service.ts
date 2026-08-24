import { HttpStatus, Inject, Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";
import type Redis from "ioredis";
import { ErrorCode } from "@solidchat/shared";
import { ApiException } from "../common/errors/api.exception";
import { REDIS_CLIENT } from "../redis/redis.module";

export type WidgetRateLimitPolicy = {
  limit: number;
  windowMs: number;
  message: string;
};

@Injectable()
export class WidgetRateLimitService {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async consume(action: string, siteId: string, visitorId: string, policy: WidgetRateLimitPolicy) {
    const visitorKey = createHash("sha256").update(`${siteId}:${visitorId}`).digest("hex");
    const key = `widget:rate-limit:${action}:${visitorKey}`;
    const count = Number(
      await this.redis.eval(
        "local count = redis.call('INCR', KEYS[1]); if count == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]); end; return count;",
        1,
        key,
        String(policy.windowMs),
      ),
    );

    if (count <= policy.limit) return;

    throw new ApiException(ErrorCode.RATE_LIMITED, policy.message, HttpStatus.TOO_MANY_REQUESTS, {
      retryAfterSeconds: Math.ceil(policy.windowMs / 1000),
    });
  }
}
