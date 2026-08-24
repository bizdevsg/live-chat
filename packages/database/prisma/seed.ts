import { PrismaClient } from "@prisma/client";
import { hash } from "@node-rs/argon2";
b;
const prisma = new PrismaClient();

const PERMISSIONS: { slug: string; category: string; description: string }[] = [
  {
    slug: "org.manage",
    category: "system",
    description: "Mengelola organization dan tenant",
  },
  { slug: "site.manage", category: "system", description: "Mengelola site" },
  {
    slug: "integration.manage",
    category: "system",
    description: "Mengelola integrasi",
  },
  {
    slug: "security.manage",
    category: "system",
    description: "Mengubah pengaturan keamanan",
  },
  {
    slug: "audit_log.view",
    category: "system",
    description: "Melihat audit log",
  },
  { slug: "user.manage", category: "people", description: "Mengelola user" },
  {
    slug: "role.manage",
    category: "people",
    description: "Mengelola role dan permission",
  },
  { slug: "team.manage", category: "people", description: "Mengelola tim" },
  {
    slug: "knowledge.edit",
    category: "knowledge",
    description: "Membuat dan mengedit artikel",
  },
  {
    slug: "knowledge.approve",
    category: "knowledge",
    description: "Menyetujui artikel",
  },
  {
    slug: "knowledge.publish",
    category: "knowledge",
    description: "Mempublikasikan artikel",
  },
  {
    slug: "ai_config.manage",
    category: "ai",
    description: "Mengelola konfigurasi AI",
  },
  {
    slug: "routing.manage",
    category: "ops",
    description: "Mengelola routing rules",
  },
  {
    slug: "template.manage",
    category: "ops",
    description: "Mengelola response template",
  },
  {
    slug: "widget.manage",
    category: "ops",
    description: "Mengelola widget settings",
  },
  {
    slug: "analytics.view",
    category: "reporting",
    description: "Melihat analytics",
  },
  {
    slug: "conversation.view_all",
    category: "chat",
    description: "Melihat seluruh conversation",
  },
  {
    slug: "conversation.view_team",
    category: "chat",
    description: "Melihat conversation tim sendiri",
  },
  {
    slug: "conversation.handle",
    category: "chat",
    description: "Menangani conversation",
  },
  {
    slug: "conversation.takeover",
    category: "chat",
    description: "Mengambil alih conversation dari AI",
  },
  {
    slug: "conversation.transfer",
    category: "chat",
    description: "Transfer conversation",
  },
  { slug: "ticket.manage", category: "chat", description: "Mengelola ticket" },
  {
    slug: "customer.view",
    category: "chat",
    description: "Melihat profil customer",
  },
  { slug: "lead.view", category: "chat", description: "Melihat lead" },
];

const ROLE_PERMISSIONS: Record<string, string[]> = {
  super_admin: PERMISSIONS.map((p) => p.slug),
  admin: [
    "team.manage",
    "user.manage",
    "knowledge.edit",
    "knowledge.approve",
    "knowledge.publish",
    "ai_config.manage",
    "routing.manage",
    "template.manage",
    "widget.manage",
    "analytics.view",
    "conversation.view_all",
    "conversation.handle",
    "conversation.takeover",
    "conversation.transfer",
    "ticket.manage",
    "customer.view",
    "lead.view",
    "audit_log.view",
  ],
  supervisor: [
    "conversation.view_team",
    "conversation.handle",
    "conversation.takeover",
    "conversation.transfer",
    "ticket.manage",
    "customer.view",
    "analytics.view",
    "knowledge.edit",
  ],
  cs_agent: [
    "conversation.handle",
    "conversation.transfer",
    "ticket.manage",
    "customer.view",
  ],
  knowledge_editor: ["knowledge.edit"],
  auditor: [
    "audit_log.view",
    "analytics.view",
    "conversation.view_all",
    "ticket.manage",
  ],
};

async function main() {
  console.log("Seeding SolidChat AI reference data...");

  await prisma.permission.createMany({
    data: PERMISSIONS,
    skipDuplicates: true,
  });

  const organization = await prisma.organization.upsert({
    where: { slug: "solid-gold" },
    update: {},
    create: {
      name: "PT Solid Gold Berjangka",
      slug: "solid-gold",
      timezone: "Asia/Jakarta",
    },
  });

  const roles: Record<string, string> = {};
  for (const slug of Object.keys(ROLE_PERMISSIONS)) {
    const role = await prisma.role.upsert({
      where: { organizationId_slug: { organizationId: organization.id, slug } },
      update: {},
      create: {
        organizationId: organization.id,
        slug,
        name: slug.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        isSystem: true,
      },
    });
    roles[slug] = role.id;

    for (const permSlug of ROLE_PERMISSIONS[slug] ?? []) {
      const permission = await prisma.permission.findUniqueOrThrow({
        where: { slug: permSlug },
      });
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: { roleId: role.id, permissionId: permission.id },
        },
        update: {},
        create: { roleId: role.id, permissionId: permission.id },
      });
    }
  }

  const site = await prisma.site.upsert({
    where: { siteKey: "solid-gold-main" },
    update: {},
    create: {
      organizationId: organization.id,
      siteKey: "solid-gold-main",
      name: "Customer Service SGB",
      widgetColor: "#D4AF37",
      aiName: "Asisten Solid Gold",
      greeting:
        "Halo, saya asisten virtual Solid Gold. Ada yang bisa saya bantu mengenai layanan, registrasi, atau panduan penggunaan?",
      offlineMessage:
        "Tim kami sedang di luar jam operasional. Silakan tinggalkan pesan dan kami akan membalas secepatnya.",
      language: "id",
      timezone: "Asia/Jakarta",
      isActive: true,
    },
  });

  await prisma.siteDomain.upsert({
    where: { siteId_domain: { siteId: site.id, domain: "localhost" } },
    update: {},
    create: { siteId: site.id, domain: "localhost" },
  });
  await prisma.siteDomain.upsert({
    where: { siteId_domain: { siteId: site.id, domain: "localhost:3000" } },
    update: {},
    create: { siteId: site.id, domain: "localhost:3000" },
  });

  await prisma.siteSettings.upsert({
    where: { siteId: site.id },
    update: {},
    create: {
      siteId: site.id,
      widgetEnabled: true,
      aiEnabled: true,
      humanChatEnabled: true,
      bubblePosition: "bottom-right",
      preChatFormEnabled: false,
      showAgentButton: true,
      allowAttachments: true,
      allowedFileTypes: [
        "image/png",
        "image/jpeg",
        "image/webp",
        "application/pdf",
      ],
      maxFileSizeBytes: 10 * 1024 * 1024,
      ratingFormEnabled: true,
      showAiSourcesToCustomer: false,
    },
  });

  const generalTeam = await prisma.team.create({
    data: {
      organizationId: organization.id,
      name: "Customer Service Umum",
      description: "Tim penanganan pertanyaan umum",
      capacityPerAgent: 5,
      routingPriority: 0,
      isActive: true,
    },
  });
  const complaintTeam = await prisma.team.create({
    data: {
      organizationId: organization.id,
      name: "Complaint Handling",
      description: "Tim penanganan keluhan dan eskalasi",
      capacityPerAgent: 3,
      routingPriority: 10,
      isActive: true,
    },
  });

  const adminEmail = process.env.INITIAL_ADMIN_EMAIL ?? "admin@solidgold.local";
  const adminName = process.env.INITIAL_ADMIN_NAME ?? "SolidChat Admin";
  const adminPassword = process.env.INITIAL_ADMIN_PASSWORD ?? "ChangeMe!12345";
  const passwordHash = await hash(adminPassword);

  const admin = await prisma.user.upsert({
    where: {
      organizationId_email: {
        organizationId: organization.id,
        email: adminEmail,
      },
    },
    update: {},
    create: {
      organizationId: organization.id,
      email: adminEmail,
      name: adminName,
      passwordHash,
      isActive: true,
    },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: admin.id, roleId: roles.super_admin! } },
    update: {},
    create: { userId: admin.id, roleId: roles.super_admin! },
  });

  const agentEmail = "agent@solidgold.local";
  const agentPasswordHash = await hash("ChangeMe!12345");
  const agent = await prisma.user.upsert({
    where: {
      organizationId_email: {
        organizationId: organization.id,
        email: agentEmail,
      },
    },
    update: {},
    create: {
      organizationId: organization.id,
      email: agentEmail,
      name: "CS Agent Demo",
      passwordHash: agentPasswordHash,
      isActive: true,
    },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: agent.id, roleId: roles.cs_agent! } },
    update: {},
    create: { userId: agent.id, roleId: roles.cs_agent! },
  });
  await prisma.agentProfile.upsert({
    where: { userId: agent.id },
    update: {},
    create: {
      userId: agent.id,
      availability: "OFFLINE",
      maxConcurrentChats: 5,
    },
  });
  await prisma.teamMember.upsert({
    where: { teamId_userId: { teamId: generalTeam.id, userId: agent.id } },
    update: {},
    create: { teamId: generalTeam.id, userId: agent.id },
  });

  // New configurations start on the economical default; administrators can change it later.
  await prisma.aiConfiguration.create({
    data: {
      organizationId: organization.id,
      siteId: site.id,
      provider: "openai",
      model: "gpt-4o-mini",
      isActive: true,
    },
  });

  await prisma.handoffRule.create({
    data: {
      siteId: site.id,
      reason: "SERIOUS_COMPLAINT",
      targetTeamId: complaintTeam.id,
      priority: "HIGH",
      isActive: true,
    },
  });
  await prisma.handoffRule.create({
    data: {
      siteId: site.id,
      reason: "CUSTOMER_REQUESTED_HUMAN",
      targetTeamId: generalTeam.id,
      priority: "NORMAL",
      isActive: true,
    },
  });

  await prisma.routingRule.create({
    data: {
      siteId: site.id,
      name: "Default routing ke tim umum",
      priority: 0,
      conditions: {},
      targetTeamId: generalTeam.id,
      strategy: "ROUND_ROBIN",
      isActive: true,
    },
  });

  const category = await prisma.knowledgeCategory.upsert({
    where: {
      organizationId_slug: {
        organizationId: organization.id,
        slug: "account-registration",
      },
    },
    update: {},
    create: {
      organizationId: organization.id,
      name: "Account Registration",
      slug: "account-registration",
      description: "Panduan pendaftaran akun baru",
    },
  });

  // Sample article only — intentionally left as DRAFT per §43: it must go through
  // review/approval before AI can use it (see acceptance criteria #8, #12).
  await prisma.knowledgeDocument.upsert({
    where: {
      siteId_slug: { siteId: site.id, slug: "panduan-registrasi-akun" },
    },
    update: {},
    create: {
      siteId: site.id,
      categoryId: category.id,
      title: "Panduan Registrasi Akun (Contoh)",
      slug: "panduan-registrasi-akun",
      content:
        "Ini adalah artikel contoh untuk keperluan demonstrasi. Silakan lengkapi dengan informasi resmi perusahaan, lalu kirimkan untuk review dan publikasikan melalui dashboard Knowledge Base sebelum digunakan oleh AI.",
      summary:
        "Contoh artikel demonstrasi — belum berisi data resmi perusahaan.",
      audience: "PUBLIC",
      status: "NON_ACTIVE",
      version: 1,
      createdById: admin.id,
    },
  });

  console.log("Seed selesai.");
  console.log(`Admin login: ${adminEmail} / ${adminPassword}`);
  console.log(`Agent login: ${agentEmail} / ChangeMe!12345`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
