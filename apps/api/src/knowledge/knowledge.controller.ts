import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiTags } from "@nestjs/swagger";
import { Permission } from "@solidchat/shared";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { JwtAccessPayload } from "@solidchat/shared";
import { KnowledgeService } from "./knowledge.service";
import { StorageService } from "../storage/storage.service";
import { PrismaService } from "../prisma/prisma.service";
import { extractTextFromFile } from "./text-extraction.util";
import { CreateKnowledgeDocumentDto, ListKnowledgeQueryDto, UpdateKnowledgeDocumentDto } from "./dto/knowledge.dto";
import { ApiException } from "../common/errors/api.exception";
import { ErrorCode } from "@solidchat/shared";
import { HttpStatus, BadRequestException } from "@nestjs/common";

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

@ApiTags("knowledge")
@UseGuards(PermissionsGuard)
@Controller("api/v1/knowledge")
export class KnowledgeController {
  constructor(
    private readonly knowledgeService: KnowledgeService,
    private readonly storage: StorageService,
    private readonly prisma: PrismaService,
  ) {}

  private async resolveSiteId(user: JwtAccessPayload): Promise<string> {
    const site = await this.prisma.site.findFirst({ where: { organizationId: user.organizationId } });
    if (!site) throw new ApiException(ErrorCode.SITE_NOT_FOUND, "Site tidak ditemukan untuk organization ini.", HttpStatus.NOT_FOUND);
    return site.id;
  }

  @Get("categories")
  async categories(@CurrentUser() user: JwtAccessPayload) {
    const data = await this.knowledgeService.listCategories(user.organizationId);
    return { success: true, data };
  }

  @Get("documents")
  @RequirePermissions(Permission.KNOWLEDGE_EDIT, Permission.KNOWLEDGE_APPROVE, Permission.AUDIT_LOG_VIEW)
  async list(@CurrentUser() user: JwtAccessPayload, @Query() query: ListKnowledgeQueryDto) {
    const siteId = await this.resolveSiteId(user);
    const data = await this.knowledgeService.list(siteId, query);
    return { success: true, data };
  }

  @Post("documents")
  @RequirePermissions(Permission.KNOWLEDGE_EDIT)
  async create(@CurrentUser() user: JwtAccessPayload, @Body() dto: CreateKnowledgeDocumentDto) {
    const siteId = await this.resolveSiteId(user);
    const data = await this.knowledgeService.create(siteId, dto, user.sub);
    return { success: true, data };
  }

  @Get("documents/:id")
  @RequirePermissions(Permission.KNOWLEDGE_EDIT, Permission.KNOWLEDGE_APPROVE, Permission.AUDIT_LOG_VIEW)
  async get(@Param("id") id: string) {
    const data = await this.knowledgeService.getOrThrow(id);
    return { success: true, data };
  }

  @Put("documents/:id")
  @RequirePermissions(Permission.KNOWLEDGE_EDIT)
  async update(@Param("id") id: string, @Body() dto: UpdateKnowledgeDocumentDto, @CurrentUser() user: JwtAccessPayload) {
    const data = await this.knowledgeService.update(id, dto, user.sub);
    return { success: true, data };
  }

  @Post("documents/:id/submit-review")
  @RequirePermissions(Permission.KNOWLEDGE_EDIT)
  async submitReview(@Param("id") id: string, @CurrentUser() user: JwtAccessPayload) {
    const data = await this.knowledgeService.submitReview(id, user.sub);
    return { success: true, data };
  }

  @Post("documents/:id/approve")
  @RequirePermissions(Permission.KNOWLEDGE_APPROVE)
  async approve(@Param("id") id: string, @CurrentUser() user: JwtAccessPayload) {
    const data = await this.knowledgeService.approve(id, user.sub);
    return { success: true, data };
  }

  @Post("documents/:id/reject")
  @RequirePermissions(Permission.KNOWLEDGE_APPROVE)
  async reject(@Param("id") id: string, @CurrentUser() user: JwtAccessPayload) {
    const data = await this.knowledgeService.reject(id, user.sub);
    return { success: true, data };
  }

  @Post("documents/:id/publish")
  @RequirePermissions(Permission.KNOWLEDGE_PUBLISH)
  async publish(@Param("id") id: string, @CurrentUser() user: JwtAccessPayload) {
    const data = await this.knowledgeService.publish(id, user.sub);
    return { success: true, data };
  }

  @Post("documents/:id/archive")
  @RequirePermissions(Permission.KNOWLEDGE_EDIT)
  async archive(@Param("id") id: string, @CurrentUser() user: JwtAccessPayload) {
    const data = await this.knowledgeService.archive(id, user.sub);
    return { success: true, data };
  }

  @Post("documents/:id/reprocess")
  @RequirePermissions(Permission.KNOWLEDGE_EDIT)
  async reprocess(@Param("id") id: string) {
    const data = await this.knowledgeService.reprocess(id);
    return { success: true, data };
  }

  @Post("upload")
  @RequirePermissions(Permission.KNOWLEDGE_EDIT)
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MAX_UPLOAD_BYTES } }))
  async upload(@UploadedFile() file: Express.Multer.File, @CurrentUser() user: JwtAccessPayload) {
    if (!file) throw new BadRequestException("File tidak ditemukan pada request.");
    const siteId = await this.resolveSiteId(user);

    const text = await extractTextFromFile(file.buffer, file.mimetype, file.originalname);
    if (text.trim().length < 20) {
      throw new BadRequestException("Tidak dapat mengekstrak teks yang cukup dari file ini.");
    }

    const storageKey = this.storage.buildStorageKey(`knowledge/${siteId}`, file.originalname);
    await this.storage.upload(storageKey, file.buffer, file.mimetype);

    const data = await this.knowledgeService.create(
      siteId,
      { title: file.originalname.replace(/\.[^.]+$/, ""), content: text },
      user.sub,
    );
    await this.prisma.knowledgeDocument.update({ where: { id: data.id }, data: { sourceFile: storageKey } });

    return { success: true, data: { ...data, sourceFile: storageKey, status: "DRAFT" } };
  }
}
