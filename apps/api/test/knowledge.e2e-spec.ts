import type { INestApplication } from "@nestjs/common";
import type { Server } from "node:http";
import request from "supertest";
import { createTestApp } from "./utils/test-app";
import { seedMinimalFixtures, cleanupFixtures, type TestFixtures } from "./utils/fixtures";
import { PrismaService } from "../src/prisma/prisma.service";

describe("Knowledge workflow (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let fixtures: TestFixtures;
  let server: Server;
  let agent: ReturnType<typeof request.agent>;

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer();
    prisma = app.get(PrismaService);
    fixtures = await seedMinimalFixtures(prisma, "knowledge");
    agent = request.agent(server);
    await agent.post("/api/v1/auth/login").send({ email: fixtures.adminEmail, password: fixtures.adminPassword });
  });

  afterAll(async () => {
    await cleanupFixtures(prisma, fixtures.organizationId);
    await app.close();
  });

  it("creates a new article as DRAFT", async () => {
    const res = await agent.post("/api/v1/knowledge/documents").send({
      title: "Panduan E2E Test",
      content: "Ini adalah konten artikel pengujian end-to-end yang cukup panjang untuk lolos validasi.",
    });
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe("DRAFT");
  });

  it("walks a document through submit-review -> approve -> publish", async () => {
    const create = await agent.post("/api/v1/knowledge/documents").send({
      title: "Panduan Publish E2E",
      content: "Konten resmi mengenai panduan publish untuk pengujian end-to-end sistem SolidChat AI.",
    });
    const id = create.body.data.id as string;

    const submitted = await agent.post(`/api/v1/knowledge/documents/${id}/submit-review`);
    expect(submitted.body.data.status).toBe("IN_REVIEW");

    const approved = await agent.post(`/api/v1/knowledge/documents/${id}/approve`);
    expect(approved.body.data.status).toBe("APPROVED");

    const published = await agent.post(`/api/v1/knowledge/documents/${id}/publish`);
    expect(published.status).toBe(201);
    expect(published.body.data.status).toBe("PUBLISHED");

    const chunks = await prisma.knowledgeChunk.findMany({ where: { documentId: id } });
    expect(chunks.length).toBeGreaterThan(0);
  });

  it("cannot publish a document that has not been approved", async () => {
    const create = await agent.post("/api/v1/knowledge/documents").send({
      title: "Panduan Belum Approved",
      content: "Konten yang belum melalui proses review dan approval sama sekali untuk pengujian.",
    });
    const id = create.body.data.id as string;

    const res = await agent.post(`/api/v1/knowledge/documents/${id}/publish`);
    expect(res.status).toBe(409);
  });

  it("rejects article creation without knowledge.edit permission", async () => {
    const noPermAgent = request.agent(server);
    await noPermAgent.post("/api/v1/auth/login").send({ email: fixtures.noPermissionEmail, password: fixtures.noPermissionPassword });
    const res = await noPermAgent.post("/api/v1/knowledge/documents").send({
      title: "Tidak Boleh",
      content: "Percobaan membuat artikel tanpa permission yang sesuai untuk pengujian keamanan.",
    });
    expect(res.status).toBe(403);
  });
});
