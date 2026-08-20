import { PrismaService } from "../prisma/prisma.service";
import type { UserAccountSettings } from "./account-settings.constants";
import { loadUserAccountSettings } from "./account-settings.util";

export interface UserAuthContext {
  userId: string;
  organizationId: string;
  email: string;
  name: string;
  roles: string[];
  permissions: string[];
  accountSettings: UserAccountSettings;
}

export async function loadUserAuthContext(prisma: PrismaService, userId: string): Promise<UserAuthContext | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } },
  });
  if (!user) return null;

  const roleSlugs = new Set<string>();
  const permissionSlugs = new Set<string>();
  for (const userRole of user.roles) {
    roleSlugs.add(userRole.role.slug);
    for (const rolePermission of userRole.role.permissions) {
      permissionSlugs.add(rolePermission.permission.slug);
    }
  }

  const accountSettings = await loadUserAccountSettings(prisma, user.id);

  return {
    userId: user.id,
    organizationId: user.organizationId,
    email: user.email,
    name: user.name,
    roles: [...roleSlugs],
    permissions: [...permissionSlugs],
    accountSettings,
  };
}
