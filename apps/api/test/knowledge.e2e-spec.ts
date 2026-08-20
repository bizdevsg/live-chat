import type { INestApplication } from "@nestjs/common";
import type { Server } from "node:http";
import request from "supertest";
import { PrismaService } from "../src/prisma/prisma.service";
import { cleanupFixtures, seedMinimalFixtures, type TestFixtures } from "./utils/fixtures";
import { createTestApp } from "./utils/test-app";

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

  it("creates a new article as NON_ACTIVE", async () => {
    const res = await agent.post("/api/v1/knowledge/documents").send({
      title: "Panduan E2E Test",
      content: "Ini adalah konten artikel pengujian end-to-end yang cukup panjang untuk lolos validasi.",
    });
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe("NON_ACTIVE");
  });

  it("activates a document and generates retrieval chunks", async () => {
    const create = await agent.post("/api/v1/knowledge/documents").send({
      title: "Panduan Aktivasi E2E",
      content: "Konten resmi mengenai aktivasi knowledge untuk pengujian end-to-end sistem SolidChat AI.",
    });
    const id = create.body.data.id as string;

    const activated = await agent.post(`/api/v1/knowledge/documents/${id}/activate`);
    expect(activated.status).toBe(201);
    expect(activated.body.data.status).toBe("ACTIVE");

    const chunks = await prisma.knowledgeChunk.findMany({ where: { documentId: id } });
    expect(chunks.length).toBeGreaterThan(0);
  });

  it("deactivates a document", async () => {
    const create = await agent.post("/api/v1/knowledge/documents").send({
      title: "Panduan Nonaktif",
      content: "Konten yang dipakai untuk menguji perubahan status aktif menjadi non-aktif pada knowledge base.",
    });
    const id = create.body.data.id as string;

    await agent.post(`/api/v1/knowledge/documents/${id}/activate`);
    const deactivated = await agent.post(`/api/v1/knowledge/documents/${id}/deactivate`);
    expect(deactivated.status).toBe(201);
    expect(deactivated.body.data.status).toBe("NON_ACTIVE");
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
