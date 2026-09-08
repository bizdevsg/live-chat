import { Inject, Injectable } from "@nestjs/common";
import type Redis from "ioredis";
import { REDIS_CLIENT } from "../../redis/redis.module";

export interface ClaraSsoAttempt {
  nonce: string;
  codeVerifier: string;
  returnPath: string;
  createdAt: string;
}

const KEY_PREFIX = "sso:clara:state:";

/**
 * Server-side storage for one Clara SSO login attempt's state/nonce/code_verifier, between
 * GET /auth/clara/login (agent leaves for Clara) and GET /auth/clara/callback (agent comes
 * back). Redis is a natural fit here — TTL expiry does the cleanup, and the agent has no local
 * session yet at this point for a cookie-bound alternative to hang this off of.
 */
@Injectable()
export class ClaraSsoStateService {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async save(state: string, attempt: ClaraSsoAttempt, ttlSeconds: number): Promise<void> {
    await this.redis.set(KEY_PREFIX + state, JSON.stringify(attempt), "EX", ttlSeconds);
  }

  /**
   * One-time read: fetches then immediately deletes, so a replayed `state` (§16, "Authorization
   * code yang digunakan ulang ditolak" applies just as much to state) can never be consumed
   * twice, even if two callback requests race.
   */
  async consume(state: string): Promise<ClaraSsoAttempt | null> {
    const key = KEY_PREFIX + state;
    const raw = await this.redis.get(key);
    if (!raw) return null;
    await this.redis.del(key);
    try {
      return JSON.parse(raw) as ClaraSsoAttempt;
    } catch {
      return null;
    }
  }
}
