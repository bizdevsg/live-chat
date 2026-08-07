import { Injectable, type ExecutionContext } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";

/** Global ThrottlerGuard, scoped to HTTP — WebSocket gateways handle their own auth/rate-limits and have no HTTP `Request` to inspect. */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  override canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== "http") return Promise.resolve(true);
    return super.canActivate(context);
  }
}
