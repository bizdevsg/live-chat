import { hash } from "@node-rs/argon2";
import { PrismaClient } from "@solidchat/database";
import { Permission } from "@solidchat/shared";

export interface TestFixtures {
  organizationId: string;
  siteId: string;
  siteKey: string;
  adminEmail: string;
  adminPassword: string;
  noPermissionEmail: string;
  noPermissionPassword: string;
}

const ADMIN_PASSWORD = "E2ePassword!123";
const NO_PERMISSION_PASSWORD = "E2ePassword!123";

/** Creates the minimal org/site/roles/users an e2e run needs. Safe to call once per test file (unique emails per run). */
export async function seedMinimalFixtures(prisma: PrismaClient, suffix: string): Promise<TestFixtures> {
  const organization = await prisma.organization.create({
    data: { name: `E2E Org ${suffix}`, slug: `e2e-org-${suffix}` },
  });

  const site = await prisma.site.create({
    data: {
      organizationId: organization.id,
      siteKey: `e2e-site-${suffix}`,
      name: "E2E Test Site",
      greeting: "Halo dari E2E test",
      offlineMessage: "Offline",
      language: "id",
    },
  });
  await prisma.siteDomain.create({ data: { siteId: site.id, domain: "e2e-test.local" } });
  await prisma.siteSettings.create({ data: { siteId: site.id } });
  await prisma.aiConfiguration.create({
    data: { organizationId: organization.id, siteId: site.id, provider: "mock", isActive: true },
  });
  const team = await prisma.team.create({
    data: { organizationId: organization.id, name: "E2E Team", capacityPerAgent: 5 },
  });
  await prisma.routingRule.create({
    data: { siteId: site.id, name: "default", priority: 0, conditions: {}, targetTeamId: team.id, strategy: "ROUND_ROBIN" },
  });

  const allPermissions = Object.values(Permission);
  for (const slug of allPermissions) {
    await prisma.permission.upsert({
      where: { slug },
      update: {},
      create: { slug, category: "e2e", description: slug },
    });
  }

  const adminRole = await prisma.role.create({
    data: { organizationId: organization.id, slug: `e2e-admin-${suffix}`, name: "E2E Admin", isSystem: false },
  });
  const permissionRows = await prisma.permission.findMany({ where: { slug: { in: allPermissions } } });
  await prisma.rolePermission.createMany({
    data: permissionRows.map((p) => ({ roleId: adminRole.id, permissionId: p.id })),
  });

  const noPermissionRole = await prisma.role.create({
    data: { organizationId: organization.id, slug: `e2e-none-${suffix}`, name: "E2E No Permission", isSystem: false },
  });

  const adminEmail = `admin-${suffix}@e2e.test`;
  const adminUser = await prisma.user.create({
    data: {
      organizationId: organization.id,
      email: adminEmail,
      name: "E2E Admin",
      passwordHash: await hash(ADMIN_PASSWORD),
      isActive: true,
    },
  });
  await prisma.userRole.create({ data: { userId: adminUser.id, roleId: adminRole.id } });
  await prisma.teamMember.create({ data: { teamId: team.id, userId: adminUser.id } });
  await prisma.agentProfile.create({ data: { userId: adminUser.id, availability: "ONLINE" } });

  const noPermissionEmail = `noperm-${suffix}@e2e.test`;
  const noPermissionUser = await prisma.user.create({
    data: {
      organizationId: organization.id,
      email: noPermissionEmail,
      name: "E2E No Permission",
      passwordHash: await hash(NO_PERMISSION_PASSWORD),
      isActive: true,
    },
  });
  await prisma.userRole.create({ data: { userId: noPermissionUser.id, roleId: noPermissionRole.id } });

  return {
    organizationId: organization.id,
    siteId: site.id,
    siteKey: site.siteKey,
    adminEmail,
    adminPassword: ADMIN_PASSWORD,
    noPermissionEmail,
    noPermissionPassword: NO_PERMISSION_PASSWORD,
  };
}

export async function cleanupFixtures(prisma: PrismaClient, organizationId: string): Promise<void> {
  const site = await prisma.site.findFirst({ where: { organizationId } });
  if (site) {
    await prisma.message.deleteMany({ where: { conversation: { siteId: site.id } } });
    await prisma.conversationContext.deleteMany({ where: { conversation: { siteId: site.id } } });
    await prisma.conversationEvent.deleteMany({ where: { conversation: { siteId: site.id } } });
    await prisma.conversationAssignment.deleteMany({ where: { conversation: { siteId: site.id } } });
    await prisma.conversationParticipant.deleteMany({ where: { conversation: { siteId: site.id } } });
    await prisma.aiRun.deleteMany({ where: { conversation: { siteId: site.id } } });
    await prisma.conversation.deleteMany({ where: { siteId: site.id } });
    await prisma.visitor.deleteMany({ where: { siteId: site.id } });
    await prisma.knowledgeChunk.deleteMany({ where: { siteId: site.id } });
    await prisma.knowledgeDocument.deleteMany({ where: { siteId: site.id } });
    await prisma.routingRule.deleteMany({ where: { siteId: site.id } });
    await prisma.siteDomain.deleteMany({ where: { siteId: site.id } });
    await prisma.siteSettings.deleteMany({ where: { siteId: site.id } });
    await prisma.aiConfiguration.deleteMany({ where: { siteId: site.id } });
  }
  await prisma.teamMember.deleteMany({ where: { team: { organizationId } } });
  await prisma.agentProfile.deleteMany({ where: { user: { organizationId } } });
  await prisma.session.deleteMany({ where: { user: { organizationId } } });
  await prisma.userRole.deleteMany({ where: { user: { organizationId } } });
  await prisma.user.deleteMany({ where: { organizationId } });
  await prisma.rolePermission.deleteMany({ where: { role: { organizationId } } });
  await prisma.role.deleteMany({ where: { organizationId } });
  await prisma.team.deleteMany({ where: { organizationId } });
  await prisma.site.deleteMany({ where: { organizationId } });
  await prisma.organization.deleteMany({ where: { id: organizationId } });
}
