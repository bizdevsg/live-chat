import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Permission, JwtAccessPayload } from "@solidchat/shared";
import { PERMISSIONS_KEY } from "../decorators/permissions.decorator";
import { ForbiddenApiException } from "../errors/api.exception";

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user as JwtAccessPayload | undefined;
    if (!user) throw new ForbiddenApiException();

    const hasPermission = required.some((permission) => user.permissions.includes(permission));
    if (!hasPermission) {
      throw new ForbiddenApiException(
        `Aksi ini memerlukan salah satu permission: ${required.join(", ")}.`,
      );
    }
    return true;
  }
}
