import type { INestApplication } from "@nestjs/common";
import type { Server } from "node:http";
import request from "supertest";
import { hash } from "@node-rs/argon2";
import { createTestApp } from "./utils/test-app";
import { seedMinimalFixtures, cleanupFixtures, type TestFixtures } from "./utils/fixtures";
import { PrismaService } from "../src/prisma/prisma.service";

describe("Auth (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let fixtures: TestFixtures;
  let server: Server;

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer();
    prisma = app.get(PrismaService);
    fixtures = await seedMinimalFixtures(prisma, "auth");
  });

  afterAll(async () => {
    await cleanupFixtures(prisma, fixtures.organizationId);
    await app.close();
  });

  it("rejects login with an unknown email", async () => {
    const res = await request(server).post("/api/v1/auth/login").send({ email: "nobody@e2e.test", password: "whatever" });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("rejects login with a wrong password", async () => {
    const res = await request(server).post("/api/v1/auth/login").send({ email: fixtures.adminEmail, password: "wrongpassword" });
    expect(res.status).toBe(401);
  });

  it("logs in with valid credentials and sets httpOnly cookies", async () => {
    const res = await request(server).post("/api/v1/auth/login").send({ email: fixtures.adminEmail, password: fixtures.adminPassword });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const cookies = res.headers["set-cookie"] as unknown as string[];
    expect(cookies.some((c) => c.startsWith("access_token=") && c.includes("HttpOnly"))).toBe(true);
    expect(cookies.some((c) => c.startsWith("refresh_token=") && c.includes("HttpOnly"))).toBe(true);
  });

  it("returns the authenticated profile from /auth/me using the session cookie", async () => {
    const agent = request.agent(server);
    await agent.post("/api/v1/auth/login").send({ email: fixtures.adminEmail, password: fixtures.adminPassword });
    const res = await agent.get("/api/v1/auth/me");
    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe(fixtures.adminEmail);
    expect(res.body.data.permissions.length).toBeGreaterThan(0);
  });

  it("rejects /auth/me without a session", async () => {
    const res = await request(server).get("/api/v1/auth/me");
    expect(res.status).toBe(401);
  });

  it("locks the account after 5 consecutive failed attempts", async () => {
    const email = `lockout-${Date.now()}@e2e.test`;
    await prisma.user.create({
      data: {
        organizationId: fixtures.organizationId,
        email,
        name: "Lockout Test",
        passwordHash: await hash("correct-password-not-guessed"),
        isActive: true,
      },
    });

    for (let i = 0; i < 5; i++) {
      await request(server).post("/api/v1/auth/login").send({ email, password: "wrong" });
    }

    const res = await request(server).post("/api/v1/auth/login").send({ email, password: "wrong" });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("ACCOUNT_LOCKED");
  });

  it("rotates the refresh token and rejects reuse of the old one", async () => {
    const loginRes = await request(server).post("/api/v1/auth/login").send({ email: fixtures.adminEmail, password: fixtures.adminPassword });
    const cookies = loginRes.headers["set-cookie"] as unknown as string[];
    const refreshCookie = cookies.find((c) => c.startsWith("refresh_token="))!;

    const firstRefresh = await request(server).post("/api/v1/auth/refresh").set("Cookie", refreshCookie).send({});
    expect(firstRefresh.status).toBe(200);

    // Reusing the original (now-rotated) refresh token should fail and revoke the family.
    const reuse = await request(server).post("/api/v1/auth/refresh").set("Cookie", refreshCookie).send({});
    expect(reuse.status).toBe(401);
  });
});
