import type { INestApplication } from "@nestjs/common";
import type { Server } from "node:http";
import request from "supertest";
import { createTestApp } from "./utils/test-app";
import { seedMinimalFixtures, cleanupFixtures, type TestFixtures } from "./utils/fixtures";
import { PrismaService } from "../src/prisma/prisma.service";

describe("Widget (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let fixtures: TestFixtures;
  let server: Server;

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer();
    prisma = app.get(PrismaService);
    fixtures = await seedMinimalFixtures(prisma, "widget");
  });

  afterAll(async () => {
    await cleanupFixtures(prisma, fixtures.organizationId);
    await app.close();
  });

  it("returns public widget config for a known site", async () => {
    const res = await request(server).get(`/api/v1/widget/config/${fixtures.siteKey}`);
    expect(res.status).toBe(200);
    expect(res.body.data.siteId).toBe(fixtures.siteKey);
  });

  it("404s for an unknown site", async () => {
    const res = await request(server).get("/api/v1/widget/config/does-not-exist");
    expect(res.status).toBe(404);
  });

  it("issues a visitor token when the page domain is allowlisted", async () => {
    const res = await request(server).post("/api/v1/widget/session").send({
      siteId: fixtures.siteKey,
      visitorId: "visitor_e2e_1",
      pageUrl: "https://e2e-test.local/help",
    });
    expect(res.status).toBe(200);
    expect(typeof res.body.data.visitorToken).toBe("string");
  });

  it("handles concurrent session requests for the same new visitor without a 500 (regression: findUnique-then-create race, and Prisma upsert() is not atomic on MySQL)", async () => {
    const visitorId = `visitor_concurrent_${Date.now()}`;
    const responses = await Promise.all(
      Array.from({ length: 8 }, () =>
        request(server).post("/api/v1/widget/session").send({
          siteId: fixtures.siteKey,
          visitorId,
          pageUrl: "https://e2e-test.local/help",
        }),
      ),
    );
    expect(responses.every((r) => r.status === 200)).toBe(true);

    const visitors = await prisma.visitor.findMany({ where: { siteId: fixtures.siteId, visitorKey: visitorId } });
    expect(visitors).toHaveLength(1); // exactly one row, no duplicate-insert race
  });

  it("rejects a session request from a domain that is not allowlisted (§8)", async () => {
    const res = await request(server).post("/api/v1/widget/session").send({
      siteId: fixtures.siteKey,
      visitorId: "visitor_e2e_2",
      pageUrl: "https://attacker.example/help",
    });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("DOMAIN_NOT_ALLOWED");
  });

  it("creates a conversation and sends a message with clientMessageId idempotency", async () => {
    const sessionRes = await request(server).post("/api/v1/widget/session").send({
      siteId: fixtures.siteKey,
      visitorId: "visitor_e2e_3",
      pageUrl: "https://e2e-test.local/help",
    });
    const token = sessionRes.body.data.visitorToken as string;

    const convRes = await request(server).post("/api/v1/widget/conversations").set("Authorization", `Bearer ${token}`).send({});
    expect(convRes.status).toBe(201); // Nest defaults POST to 201 unless overridden
    const conversationId = convRes.body.data.id as string;

    const send = () =>
      request(server)
        .post(`/api/v1/widget/conversations/${conversationId}/messages`)
        .set("Authorization", `Bearer ${token}`)
        .send({ content: "Halo, saya butuh bantuan", clientMessageId: "dup-1" });

    const first = await send();
    const second = await send();
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(first.body.data.id).toBe(second.body.data.id); // idempotent retry returns the same message

    const messages = await prisma.message.findMany({ where: { conversationId } });
    expect(messages).toHaveLength(1);
  });

  it("rejects requests without a visitor token", async () => {
    const res = await request(server).post("/api/v1/widget/conversations").send({});
    expect(res.status).toBe(401);
  });

  it("denies a visitor from reading another visitor's conversation (§31 cross-conversation access)", async () => {
    const sessionA = await request(server).post("/api/v1/widget/session").send({
      siteId: fixtures.siteKey,
      visitorId: "visitor_e2e_owner",
      pageUrl: "https://e2e-test.local/help",
    });
    const tokenA = sessionA.body.data.visitorToken as string;
    const convA = await request(server).post("/api/v1/widget/conversations").set("Authorization", `Bearer ${tokenA}`).send({});
    const conversationId = convA.body.data.id as string;

    const sessionB = await request(server).post("/api/v1/widget/session").send({
      siteId: fixtures.siteKey,
      visitorId: "visitor_e2e_intruder",
      pageUrl: "https://e2e-test.local/help",
    });
    const tokenB = sessionB.body.data.visitorToken as string;

    const res = await request(server).get(`/api/v1/widget/conversations/${conversationId}`).set("Authorization", `Bearer ${tokenB}`);
    expect(res.status).toBe(403);
  });

  it("never returns internal notes to the widget (§14)", async () => {
    const sessionRes = await request(server).post("/api/v1/widget/session").send({
      siteId: fixtures.siteKey,
      visitorId: "visitor_e2e_internal",
      pageUrl: "https://e2e-test.local/help",
    });
    const token = sessionRes.body.data.visitorToken as string;
    const convRes = await request(server).post("/api/v1/widget/conversations").set("Authorization", `Bearer ${token}`).send({});
    const conversationId = convRes.body.data.id as string;

    await prisma.message.create({
      data: { conversationId, senderType: "AGENT", content: "internal-only note", messageType: "INTERNAL_NOTE", isInternal: true },
    });

    const res = await request(server).get(`/api/v1/widget/conversations/${conversationId}`).set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    const contents = (res.body.data.messages as Array<{ content: string }>).map((m) => m.content);
    expect(contents).not.toContain("internal-only note");
  });
});
