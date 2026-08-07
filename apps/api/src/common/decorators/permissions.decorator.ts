import { SetMetadata } from "@nestjs/common";
import type { Permission } from "@solidchat/shared";

export const PERMISSIONS_KEY = "permissions";
/** Any one of the listed permissions grants access; enforced by PermissionsGuard against DB-backed role_permissions. */
export const RequirePermissions = (...permissions: Permission[]) => SetMetadata(PERMISSIONS_KEY, permissions);
