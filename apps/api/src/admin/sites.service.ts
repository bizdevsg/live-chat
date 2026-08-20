import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuditLogService } from "../common/audit/audit-log.service";
import { NotFoundApiException } from "../common/errors/api.exception";
import { ErrorCode } from "@solidchat/shared";
import type { AddDomainDto, CreateSiteDto, UpdateSiteDto, UpdateWidgetSettingsDto } from "./dto/admin.dto";

@Injectable()
export class SitesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async list(organizationId: string) {
    return this.prisma.site.findMany({ where: { organizationId }, include: { domains: true, settings: true } });
  }

  async getOrThrow(id: string) {
    const site = await this.prisma.site.findUnique({ where: { id }, include: { domains: true, settings: true } });
    if (!site) throw new NotFoundApiException(ErrorCode.SITE_NOT_FOUND, "Site tidak ditemukan.");
    return site;
  }

  async create(organizationId: string, dto: CreateSiteDto, actorId: string) {
    const site = await this.prisma.site.create({
      data: {
        organizationId,
        siteKey: dto.siteKey,
        name: dto.name,
        aiName: dto.aiName ?? "Asisten Virtual",
        greeting: dto.greeting ?? "Halo! Ada yang bisa kami bantu?",
        offlineMessage: dto.offlineMessage ?? "Tim kami sedang di luar jam operasional.",
        language: dto.language ?? "id",
        widgetColor: dto.widgetColor ?? "#D4AF37",
      },
    });
    await this.prisma.siteSettings.create({ data: { siteId: site.id } });
    await this.auditLog.record({ organizationId, actorType: "USER", actorId, action: "site.created", resourceType: "site", resourceId: site.id });
    return site;
  }

  async update(id: string, dto: UpdateSiteDto, actorId: string) {
    const site = await this.prisma.site.update({ where: { id }, data: dto });
    await this.auditLog.record({ actorType: "USER", actorId, action: "site.updated", resourceType: "site", resourceId: id });
    return site;
  }

  async addDomain(siteId: string, dto: AddDomainDto, actorId: string) {
    const domain = await this.prisma.siteDomain.create({ data: { siteId, domain: dto.domain.toLowerCase() } });
    await this.auditLog.record({ actorType: "USER", actorId, action: "site.domain_added", resourceType: "site", resourceId: siteId, afterData: dto });
    return domain;
  }

  async removeDomain(domainId: string, actorId: string) {
    await this.prisma.siteDomain.delete({ where: { id: domainId } });
    await this.auditLog.record({ actorType: "USER", actorId, action: "site.domain_removed", resourceType: "site_domain", resourceId: domainId });
  }

  async updateWidgetSettings(siteId: string, dto: UpdateWidgetSettingsDto, actorId: string) {
    const settings = await this.prisma.siteSettings.upsert({
      where: { siteId },
      update: dto as object,
      create: { siteId, ...dto } as never,
    });
    await this.auditLog.record({ actorType: "USER", actorId, action: "widget_settings.updated", resourceType: "site", resourceId: siteId, afterData: dto });
    return settings;
  }
}
