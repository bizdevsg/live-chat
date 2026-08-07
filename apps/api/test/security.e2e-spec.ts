import type { INestApplication } from "@nestjs/common";
import type { Server } from "node:http";
import request from "supertest";
import { createTestApp } from "./utils/test-app";
import { seedMinimalFixtures, cleanupFixtures, type TestFixtures } from "./utils/fixtures";
import { PrismaService } from "../src/prisma/prisma.service";

describe("Security (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let fixtures: TestFixtures;
  let server: Server;

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer();
    prisma = app.get(PrismaService);
    fixtures = await seedMinimalFixtures(prisma, "security");
  });

  afterAll(async () => {
    await cleanupFixtures(prisma, fixtures.organizationId);
    await app.close();
  });

  it("rejects unauthenticated access to a staff endpoint", async () => {
    const res = await request(server).get("/api/v1/admin/users");
    expect(res.status).toBe(401);
  });

  it("rejects an authenticated user who lacks the required permission", async () => {
    const agent = request.agent(server);
    await agent.post("/api/v1/auth/login").send({ email: fixtures.noPermissionEmail, password: fixtures.noPermissionPassword });
    const res = await agent.get("/api/v1/admin/users");
    expect(res.status).toBe(403);
  });

  it("allows an authenticated user with the required permission", async () => {
    const agent = request.agent(server);
    await agent.post("/api/v1/auth/login").send({ email: fixtures.adminEmail, password: fixtures.adminPassword });
    const res = await agent.get("/api/v1/admin/users");
    expect(res.status).toBe(200);
  });

  it("rejects a malformed/garbage access token instead of crashing", async () => {
    const res = await request(server).get("/api/v1/auth/me").set("Cookie", "access_token=not-a-real-jwt");
    expect(res.status).toBe(401);
  });

  it("returns a consistent error envelope with a request id, never a stack trace", async () => {
    const res = await request(server).get("/api/v1/admin/users");
    expect(res.body).toEqual({
      success: false,
      error: expect.objectContaining({ code: expect.any(String), message: expect.any(String), requestId: expect.any(String) }),
    });
    expect(JSON.stringify(res.body)).not.toMatch(/at Object\.|node_modules/);
  });

  it("rejects requests carrying unrecognized body properties instead of silently accepting them (mass-assignment guard)", async () => {
    const agent = request.agent(server);
    await agent.post("/api/v1/auth/login").send({ email: fixtures.adminEmail, password: fixtures.adminPassword });
    const res = await agent.post("/api/v1/admin/teams").send({ name: "Team X", organizationId: "attacker-supplied-org-id" });
    expect(res.status).toBe(400);
  });

  it("derives organizationId from the authenticated session, never from client input", async () => {
    const agent = request.agent(server);
    await agent.post("/api/v1/auth/login").send({ email: fixtures.adminEmail, password: fixtures.adminPassword });
    const res = await agent.post("/api/v1/admin/teams").send({ name: "Team Y" });
    expect(res.status).toBe(201);
    expect(res.body.data.organizationId).toBe(fixtures.organizationId);
  });
});
