import { Injectable, Logger } from "@nestjs/common";
import { chunkText, checksumText } from "@solidchat/ai-core";
import { KnowledgeStatus, ErrorCode } from "@solidchat/shared";
import { PrismaService } from "../prisma/prisma.service";
import { AuditLogService } from "../common/audit/audit-log.service";
import { AiProviderFactory } from "../ai/ai-provider.factory";
import { ApiException, ForbiddenApiException, NotFoundApiException } from "../common/errors/api.exception";
import { HttpStatus } from "@nestjs/common";
import type { CreateKnowledgeDocumentDto, ListKnowledgeQueryDto, UpdateKnowledgeDocumentDto } from "./dto/knowledge.dto";

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

@Injectable()
export class KnowledgeService {
  private readonly logger = new Logger(KnowledgeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly aiProviderFactory: AiProviderFactory,
  ) {}

  async list(siteId: string, query: ListKnowledgeQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = {
      siteId,
      status: query.status || undefined,
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
    return { items, total, page, pageSize };
  }

  async getOrThrow(id: string) {
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
        tags: dto.tags ?? [],
        status: KnowledgeStatus.DRAFT,
        version: 1,
        createdById: userId,
        checksum: checksumText(dto.content),
      },
    });

    await this.auditLog.record({
      actorType: "USER",
      actorId: userId,
      action: "knowledge.created",
      resourceType: "knowledge_document",
      resourceId: doc.id,
    });
    return doc;
  }

  async update(id: string, dto: UpdateKnowledgeDocumentDto, userId: string) {
    const before = await this.getOrThrow(id);
    if (![KnowledgeStatus.DRAFT, KnowledgeStatus.REJECTED, KnowledgeStatus.IN_REVIEW].includes(before.status as never)) {
      throw new ForbiddenApiException("Artikel yang sudah dipublikasikan harus diarsipkan lalu dibuat versi baru.");
    }

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
        checksum: dto.content ? checksumText(dto.content) : undefined,
        version: contentChanged ? { increment: 1 } : undefined,
      },
    });

    if (contentChanged) {
      await this.prisma.knowledgeDocumentVersion.create({
        data: {
          documentId: id,
          version: before.version,
          title: before.title,
          content: before.content,
          status: before.status,
          changedById: userId,
        },
      });
    }

    await this.auditLog.record({
      actorType: "USER",
      actorId: userId,
      action: "knowledge.updated",
      resourceType: "knowledge_document",
      resourceId: id,
      beforeData: { title: before.title, status: before.status },
      afterData: { title: updated.title, status: updated.status },
    });
    return updated;
  }

  async submitReview(id: string, userId: string) {
    return this.transition(id, userId, [KnowledgeStatus.DRAFT, KnowledgeStatus.REJECTED], KnowledgeStatus.IN_REVIEW, "knowledge.submitted_for_review");
  }

  async approve(id: string, userId: string) {
    const doc = await this.transition(id, userId, [KnowledgeStatus.IN_REVIEW], KnowledgeStatus.APPROVED, "knowledge.approved");
    await this.prisma.knowledgeDocument.update({ where: { id }, data: { reviewedById: userId, approvedById: userId } });
    return doc;
  }

  async reject(id: string, userId: string) {
    return this.transition(id, userId, [KnowledgeStatus.IN_REVIEW], KnowledgeStatus.REJECTED, "knowledge.rejected");
  }

  async publish(id: string, userId: string) {
    const doc = await this.getOrThrow(id);
    if (doc.status !== KnowledgeStatus.APPROVED) {
      throw new ApiException(
        ErrorCode.CONFLICT,
        "Artikel harus berstatus APPROVED sebelum dipublikasikan.",
        HttpStatus.CONFLICT,
      );
    }
    await this.reprocess(id); // ensure the RAG index reflects the exact published content

    const updated = await this.prisma.knowledgeDocument.update({
      where: { id },
      data: {
        status: KnowledgeStatus.PUBLISHED,
        publishedAt: new Date(),
        effectiveDate: doc.effectiveDate ?? new Date(),
      },
    });
    await this.auditLog.record({ actorType: "USER", actorId: userId, action: "knowledge.published", resourceType: "knowledge_document", resourceId: id });
    return updated;
  }

  async archive(id: string, userId: string) {
    return this.transition(
      id,
      userId,
      [KnowledgeStatus.PUBLISHED, KnowledgeStatus.APPROVED, KnowledgeStatus.DRAFT, KnowledgeStatus.EXPIRED],
      KnowledgeStatus.ARCHIVED,
      "knowledge.archived",
    );
  }

  async reprocess(id: string) {
    const doc = await this.getOrThrow(id);
    const { provider, config } = await this.aiProviderFactory.getProviderForSite(doc.siteId);
    const chunks = chunkText(doc.content);

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
          embeddingModel: config.embeddingModel,
          embeddingDimension: embedding.length || undefined,
          checksum: chunk.checksum,
        },
      });
    }
    return { chunkCount: chunks.length };
  }

  private async transition(id: string, userId: string, allowedFrom: string[], to: string, action: string) {
    const doc = await this.getOrThrow(id);
    if (!allowedFrom.includes(doc.status)) {
      throw new ApiException(
        ErrorCode.CONFLICT,
        `Tidak dapat mengubah status dari ${doc.status} ke ${to}.`,
        HttpStatus.CONFLICT,
      );
    }
    const updated = await this.prisma.knowledgeDocument.update({ where: { id }, data: { status: to } });
    await this.auditLog.record({ actorType: "USER", actorId: userId, action, resourceType: "knowledge_document", resourceId: id });
    return updated;
  }

  async listCategories(organizationId: string) {
    return this.prisma.knowledgeCategory.findMany({ where: { organizationId } });
  }
}
