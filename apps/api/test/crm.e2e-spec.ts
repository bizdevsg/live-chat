import type { INestApplication } from "@nestjs/common";
import type { Server } from "node:http";
import request from "supertest";
import { ConversationStatus, HandlerType, MessageType, SenderType } from "@solidchat/shared";
import { createTestApp } from "./utils/test-app";
import { seedMinimalFixtures, cleanupFixtures, type TestFixtures } from "./utils/fixtures";
import { PrismaService } from "../src/prisma/prisma.service";

describe("CRM export (e2e)", () => {
  const suffix = "crm";
  const siteKey = `e2e-site-${suffix}`;
  const scopedApiKey = "crm-scoped-test-key";
  let app: INestApplication;
  let prisma: PrismaService;
  let fixtures: TestFixtures;
  let server: Server;
  let conversationId: string;

  beforeAll(async () => {
    process.env.CRM_API_KEYS = JSON.stringify([{ key: scopedApiKey, siteIds: [siteKey], label: "e2e" }]);
    delete process.env.CRM_INBOUND_API_KEY;
    process.env.OPENAI_API_KEY ??= "test-openai-key";

    app = await createTestApp();
    server = app.getHttpServer();
    prisma = app.get(PrismaService);
    fixtures = await seedMinimalFixtures(prisma, suffix);

    const adminUser = await prisma.user.findUniqueOrThrow({ where: { organizationId_email: { organizationId: fixtures.organizationId, email: fixtures.adminEmail } } });
    const team = await prisma.team.findFirstOrThrow({ where: { organizationId: fixtures.organizationId } });
    const customer = await prisma.customer.create({
      data: {
        siteId: fixtures.siteId,
        name: "CRM E2E Customer",
        email: "customer.crm@e2e.test",
        phone: "+628123456789",
      },
    });

    const conversation = await prisma.conversation.create({
      data: {
        organizationId: fixtures.organizationId,
        siteId: fixtures.siteId,
        customerId: customer.id,
        assignedAgentId: adminUser.id,
        assignedTeamId: team.id,
        status: ConversationStatus.AGENT_ACTIVE,
        handlerType: HandlerType.HUMAN,
        priority: "NORMAL",
        channel: "WIDGET",
        language: "id",
        firstMessageAt: new Date("2026-08-27T09:00:00.000Z"),
        firstResponseAt: new Date("2026-08-27T09:01:00.000Z"),
        lastMessageAt: new Date("2026-08-27T09:05:00.000Z"),
      },
    });
    conversationId = conversation.id;

    await prisma.conversationContext.create({
      data: {
        conversationId,
        pageUrl: "https://e2e-test.local/help",
        pageTitle: "Help",
      },
    });

    await prisma.conversationSummary.create({
      data: {
        conversationId,
        customerGoal: "Minta bantuan terkait akun.",
        importantFacts: ["Sudah verifikasi email"],
        actionsTaken: ["Agent cek histori"],
        openIssues: ["Menunggu follow up"],
        trigger: "MANUAL",
      },
    });

    await prisma.message.createMany({
      data: [
        {
          conversationId,
          senderType: SenderType.VISITOR,
          messageType: MessageType.TEXT,
          content: "Halo, saya butuh bantuan akun.",
          contentSanitized: "Halo, saya butuh bantuan akun.",
          createdAt: new Date("2026-08-27T09:00:00.000Z"),
        },
        {
          conversationId,
          senderType: SenderType.AGENT,
          senderId: adminUser.id,
          messageType: MessageType.TEXT,
          content: "Baik, kami bantu cek sekarang.",
          createdAt: new Date("2026-08-27T09:02:00.000Z"),
        },
        {
          conversationId,
          senderType: SenderType.AGENT,
          senderId: adminUser.id,
          messageType: MessageType.INTERNAL_NOTE,
          content: "Catatan internal rahasia.",
          isInternal: true,
          createdAt: new Date("2026-08-27T09:03:00.000Z"),
        },
        {
          conversationId,
          senderType: SenderType.AI,
          messageType: MessageType.AI_SUGGESTION,
          content: "Saran AI internal.",
          createdAt: new Date("2026-08-27T09:04:00.000Z"),
        },
      ],
    });
  });

  afterAll(async () => {
    await cleanupFixtures(prisma, fixtures.organizationId);
    await app.close();
  });

  it("rejects CRM requests without an API key", async () => {
    const res = await request(server).get("/api/v1/conversations").query({ email: fixtures.adminEmail });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("rejects an unknown API key", async () => {
    const res = await request(server)
      .get("/api/v1/conversations")
      .set("Authorization", "Bearer wrong-key")
      .query({ email: fixtures.adminEmail });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("rejects a site_id outside the credential's scope", async () => {
    const res = await request(server)
      .get("/api/v1/conversations")
      .set("Authorization", `Bearer ${scopedApiKey}`)
      .query({ email: fixtures.adminEmail, site_id: "some-other-site" });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("lists conversations by assigned agent email for CRM consumers", async () => {
    const res = await request(server)
      .get("/api/v1/conversations")
      .set("Authorization", `Bearer ${scopedApiKey}`)
      .query({ email: fixtures.adminEmail.toUpperCase() });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({
      id: conversationId,
      assignedAgent: { name: "E2E Admin" },
      customer: { email: "customer.crm@e2e.test" },
      messageCount: 2,
    });
    expect(res.body.data[0].latestMessage.content).toBe("Baik, kami bantu cek sekarang.");
  });

  it("accepts the x-api-key header as an alternative to Authorization: Bearer", async () => {
    const res = await request(server)
      .get("/api/v1/conversations")
      .set("x-api-key", scopedApiKey)
      .query({ email: fixtures.adminEmail });
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  it("returns an empty list for an email with no matching agent", async () => {
    const res = await request(server)
      .get("/api/v1/conversations")
      .set("Authorization", `Bearer ${scopedApiKey}`)
      .query({ email: "nobody@e2e.test" });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it("rejects an invalid email", async () => {
    const res = await request(server)
      .get("/api/v1/conversations")
      .set("Authorization", `Bearer ${scopedApiKey}`)
      .query({ email: "not-an-email" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns conversation detail without internal-only messages", async () => {
    const res = await request(server)
      .get(`/api/v1/conversations/${conversationId}`)
      .set("Authorization", `Bearer ${scopedApiKey}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(conversationId);
    expect(res.body.data.assignedAgent).toMatchObject({ name: "E2E Admin" });
    expect(res.body.data.latestSummary.customerGoal).toBe("Minta bantuan terkait akun.");
    expect(res.body.data.messages).toHaveLength(2);
    expect(res.body.data.messages.map((message: { content: string }) => message.content)).toEqual([
      "Halo, saya butuh bantuan akun.",
      "Baik, kami bantu cek sekarang.",
    ]);
  });

  it("returns 404 for a conversation detail that does not exist", async () => {
    const res = await request(server)
      .get("/api/v1/conversations/does-not-exist")
      .set("Authorization", `Bearer ${scopedApiKey}`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("CONVERSATION_NOT_FOUND");
  });
});
