import { Injectable, Logger } from "@nestjs/common";
import { chunkText } from "@solidchat/ai-core";
import { AI_MODELS, KnowledgeStatus, ErrorCode, normalizeWikiLinksForIndexing } from "@solidchat/shared";
import { PrismaService } from "../prisma/prisma.service";
import { AuditLogService } from "../common/audit/audit-log.service";
import { AiProviderFactory } from "../ai/ai-provider.factory";
import { NotFoundApiException } from "../common/errors/api.exception";
import type { CreateKnowledgeDocumentDto, ListKnowledgeQueryDto, UpdateKnowledgeDocumentDto } from "./dto/knowledge.dto";
import { StorageService } from "../storage/storage.service";

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

const ACTIVE_STATUSES = [KnowledgeStatus.ACTIVE, KnowledgeStatus.PUBLISHED] as const;
const NON_ACTIVE_STATUSES = [
  KnowledgeStatus.NON_ACTIVE,
  KnowledgeStatus.DRAFT,
  KnowledgeStatus.IN_REVIEW,
  KnowledgeStatus.APPROVED,
  KnowledgeStatus.EXPIRED,
  KnowledgeStatus.ARCHIVED,
  KnowledgeStatus.REJECTED,
] as const;

function normalizeKnowledgeStatus(status: string) {
  return ACTIVE_STATUSES.includes(status as (typeof ACTIVE_STATUSES)[number]) ? KnowledgeStatus.ACTIVE : KnowledgeStatus.NON_ACTIVE;
}

@Injectable()
export class KnowledgeService {
  private readonly logger = new Logger(KnowledgeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly aiProviderFactory: AiProviderFactory,
    private readonly storage: StorageService,
  ) {}

  async list(siteId: string, query: ListKnowledgeQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const requestedStatus =
      query.status === KnowledgeStatus.ACTIVE
        ? { in: [...ACTIVE_STATUSES] }
        : query.status === KnowledgeStatus.NON_ACTIVE
          ? { in: [...NON_ACTIVE_STATUSES] }
          : undefined;
    const where = {
      siteId,
      status: requestedStatus,
      audience: query.audience || undefined,
      categoryId: query.categoryId || undefined,
      ...(query.search
        ? { OR: [{ title: { contains: query.search } }, { content: { contains: query.search } }] }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.knowledgeDocument.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { category: true },
      }),
      this.prisma.knowledgeDocument.count({ where }),
    ]);
    return { items: items.map((item) => this.serializeDocument(item)), total, page, pageSize };
  }

  async getOrThrow(id: string) {
    const doc = await this.prisma.knowledgeDocument.findUnique({ where: { id }, include: { category: true, chunks: true } });
    if (!doc) throw new NotFoundApiException(ErrorCode.NOT_FOUND, "Artikel knowledge tidak ditemukan.");
    return this.serializeDocument(doc);
  }

  async getRawOrThrow(id: string) {
    const doc = await this.prisma.knowledgeDocument.findUnique({ where: { id }, include: { category: true, chunks: true } });
    if (!doc) throw new NotFoundApiException(ErrorCode.NOT_FOUND, "Artikel knowledge tidak ditemukan.");
    return doc;
  }

  async create(siteId: string, dto: CreateKnowledgeDocumentDto, userId: string) {
    let slug = slugify(dto.title);
    const existing = await this.prisma.knowledgeDocument.findUnique({ where: { siteId_slug: { siteId, slug } } });
    if (existing) slug = `${slug}-${Date.now().toString(36)}`;

    const doc = await this.prisma.knowledgeDocument.create({
      data: {
        siteId,
        title: dto.title,
        slug,
        content: dto.content,
        summary: dto.summary,
        categoryId: dto.categoryId,
        audience: dto.audience ?? "PUBLIC",
        effectiveDate: dto.effectiveDate ? new Date(dto.effectiveDate) : undefined,
        expiredDate: dto.expiredDate ? new Date(dto.expiredDate) : undefined,
        status: KnowledgeStatus.NON_ACTIVE,
        version: 1,
        createdById: userId,
      },
    });

    await this.auditLog.record({
      actorType: "USER",
      actorId: userId,
      action: "knowledge.created",
      resourceType: "knowledge_document",
      resourceId: doc.id,
    });
    return this.serializeDocument(doc);
  }

  async update(id: string, dto: UpdateKnowledgeDocumentDto, userId: string) {
    const before = await this.getRawOrThrow(id);

    const contentChanged = dto.content !== undefined && dto.content !== before.content;
    const updated = await this.prisma.knowledgeDocument.update({
      where: { id },
      data: {
        title: dto.title,
        content: dto.content,
        summary: dto.summary,
        categoryId: dto.categoryId,
        audience: dto.audience,
        effectiveDate: dto.effectiveDate ? new Date(dto.effectiveDate) : undefined,
        expiredDate: dto.expiredDate ? new Date(dto.expiredDate) : undefined,
        version: contentChanged ? { increment: 1 } : undefined,
      },
    });

    if (contentChanged && normalizeKnowledgeStatus(before.status) === KnowledgeStatus.ACTIVE) {
      await this.reprocess(id);
    }

    await this.auditLog.record({
      actorType: "USER",
      actorId: userId,
      action: "knowledge.updated",
      resourceType: "knowledge_document",
      resourceId: id,
      beforeData: { title: before.title, status: before.status },
      afterData: { title: updated.title, status: normalizeKnowledgeStatus(updated.status) },
    });
    return this.serializeDocument(updated);
  }

  async remove(id: string, userId: string) {
    const doc = await this.getRawOrThrow(id);

    await this.prisma.knowledgeDocument.delete({ where: { id } });
    await this.auditLog.record({
      actorType: "USER",
      actorId: userId,
      action: "knowledge.deleted",
      resourceType: "knowledge_document",
      resourceId: id,
      beforeData: { title: doc.title, status: doc.status, sourceFile: doc.sourceFile },
    });

    if (doc.sourceFile) {
      try {
        await this.storage.remove(doc.sourceFile);
      } catch (error) {
        this.logger.warn(`Failed to remove knowledge source file ${doc.sourceFile}: ${(error as Error).message}`);
      }
    }

    return { id };
  }

  async submitReview(id: string, userId: string) {
    return this.activate(id, userId);
  }

  async approve(id: string, userId: string) {
    return this.activate(id, userId);
  }

  async reject(id: string, userId: string) {
    return this.deactivate(id, userId);
  }

  async publish(id: string, userId: string) {
    return this.activate(id, userId);
  }

  async activate(id: string, userId: string) {
    const doc = await this.getRawOrThrow(id);
    await this.reprocess(id); // ensure the RAG index reflects the exact published content

    const updated = await this.prisma.knowledgeDocument.update({
      where: { id },
      data: {
        status: KnowledgeStatus.ACTIVE,
        effectiveDate: doc.effectiveDate ?? new Date(),
      },
    });
    await this.auditLog.record({ actorType: "USER", actorId: userId, action: "knowledge.activated", resourceType: "knowledge_document", resourceId: id });
    return this.serializeDocument(updated);
  }

  async archive(id: string, userId: string) {
    return this.deactivate(id, userId);
  }

  async deactivate(id: string, userId: string) {
    const updated = await this.prisma.knowledgeDocument.update({
      where: { id },
      data: { status: KnowledgeStatus.NON_ACTIVE },
    });
    await this.auditLog.record({ actorType: "USER", actorId: userId, action: "knowledge.deactivated", resourceType: "knowledge_document", resourceId: id });
    return this.serializeDocument(updated);
  }

  async reprocess(id: string) {
    const doc = await this.getRawOrThrow(id);
    const { provider } = await this.aiProviderFactory.getProviderForSite(doc.siteId);
    const chunks = chunkText(normalizeWikiLinksForIndexing(doc.content));

    await this.prisma.knowledgeChunk.deleteMany({ where: { documentId: id } });
    for (const chunk of chunks) {
      let embedding: number[] = [];
      try {
        embedding = await provider.createEmbedding({ text: chunk.content });
      } catch (error) {
        this.logger.warn(`Embedding generation failed for chunk ${chunk.chunkIndex} of ${id}: ${(error as Error).message}`);
      }
      await this.prisma.knowledgeChunk.create({
        data: {
          documentId: id,
          siteId: doc.siteId,
          chunkIndex: chunk.chunkIndex,
          content: chunk.content,
          tokenCount: chunk.tokenCount,
          embedding: embedding.length > 0 ? embedding : undefined,
          embeddingModel: AI_MODELS.embedding,
          embeddingDimension: embedding.length || undefined,
          checksum: chunk.checksum,
        },
      });
    }
    return { chunkCount: chunks.length };
  }

  async listCategories(organizationId: string) {
    return this.prisma.knowledgeCategory.findMany({ where: { organizationId } });
  }

  private serializeDocument<T extends { status: string }>(doc: T) {
    return { ...doc, status: normalizeKnowledgeStatus(doc.status) };
  }
}
