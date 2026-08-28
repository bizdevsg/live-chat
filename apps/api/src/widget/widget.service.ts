import { Injectable, HttpStatus } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import jwt from "jsonwebtoken";
import { createHash } from "node:crypto";
import { ErrorCode, type CustomerIdentityTokenPayload } from "@solidchat/shared";
import { PrismaService } from "../prisma/prisma.service";
import { ConversationsService } from "../conversations/conversations.service";
import { VisitorTokenService } from "./visitor-token.service";
import { SecurityEventService } from "../common/security/security-event.service";
import { PresenceService } from "../common/presence/presence.service";
import { ApiException, ForbiddenApiException, NotFoundApiException, UnauthorizedApiException } from "../common/errors/api.exception";
import type { CreateWidgetSessionDto } from "./dto/widget.dto";

function hashIp(ip: string | undefined): string | undefined {
  if (!ip) return undefined;
  return createHash("sha256").update(ip).digest("hex").slice(0, 32);
}

function normalizeDomainEntry(input: string) {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return trimmed;

  try {
    return new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`).host.toLowerCase();
  } catch {
    return trimmed
      .replace(/^[a-z]+:\/\//i, "")
      .replace(/\/.*$/, "")
      .toLowerCase();
  }
}

function wildcardMatches(hostname: string, pattern: string) {
  if (!pattern.startsWith("*.")) return false;
  const suffix = pattern.slice(2);
  return hostname === suffix || hostname.endsWith(`.${suffix}`);
}

@Injectable()
export class WidgetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly conversations: ConversationsService,
    private readonly visitorTokens: VisitorTokenService,
    private readonly securityEvents: SecurityEventService,
    private readonly presence: PresenceService,
    private readonly config: ConfigService,
  ) {}

  async getPublicConfig(siteKey: string) {
    const site = await this.prisma.site.findUnique({ where: { siteKey }, include: { settings: true } });
    if (!site || !site.isActive) {
      throw new NotFoundApiException(ErrorCode.SITE_NOT_FOUND, "Website tidak ditemukan atau tidak aktif.");
    }
    const presenceStatus = await this.presence.computeOrgPresence(site.organizationId);
    return {
      siteId: site.siteKey,
      name: site.name,
      aiName: site.aiName,
      logoUrl: site.logoUrl,
      widgetColor: site.widgetColor,
      greeting: site.greeting,
      offlineMessage: site.offlineMessage,
      language: site.language,
      presenceStatus,
      settings: site.settings
        ? {
            widgetEnabled: site.settings.widgetEnabled,
            aiEnabled: site.settings.aiEnabled,
            humanChatEnabled: site.settings.humanChatEnabled,
            bubblePosition: site.settings.bubblePosition,
            preChatFormEnabled: site.settings.preChatFormEnabled,
            preChatFormFields: site.settings.preChatFormFields,
            quickReplies: site.settings.quickReplies,
            suggestedQuestions: site.settings.suggestedQuestions,
            showAgentButton: site.settings.showAgentButton,
            allowAttachments: site.settings.allowAttachments,
            allowedFileTypes: site.settings.allowedFileTypes,
            maxFileSizeBytes: site.settings.maxFileSizeBytes,
            privacyNoticeUrl: site.settings.privacyNoticeUrl,
            termsUrl: site.settings.termsUrl,
            ratingFormEnabled: site.settings.ratingFormEnabled,
      }
        : null,
    };
  }

  private extractPageOrigin(url?: string): { host: string; hostname: string } | null {
    if (!url) return null;
    try {
      const parsed = new URL(url);
      return { host: parsed.host.toLowerCase(), hostname: parsed.hostname.toLowerCase() };
    } catch {
      return null;
    }
  }

  private isAllowedDomain(pageOrigin: { host: string; hostname: string }, allowedDomains: string[]) {
    return allowedDomains.some((entry) => {
      const normalized = normalizeDomainEntry(entry);
      return (
        normalized === pageOrigin.host ||
        normalized === pageOrigin.hostname ||
        wildcardMatches(pageOrigin.hostname, normalized)
      );
    });
  }

  async createSession(dto: CreateWidgetSessionDto, meta: { ip?: string; userAgent?: string }) {
    const site = await this.prisma.site.findUnique({ where: { siteKey: dto.siteId }, include: { domains: true } });
    if (!site || !site.isActive) {
      throw new NotFoundApiException(ErrorCode.SITE_NOT_FOUND, "Website tidak ditemukan atau tidak aktif.");
    }

    const pageOrigin = this.extractPageOrigin(dto.pageUrl);
    const allowedDomains = site.domains.map((d) => d.domain);
    if (pageOrigin && !this.isAllowedDomain(pageOrigin, allowedDomains)) {
      await this.securityEvents.record({
        organizationId: site.organizationId,
        type: "DOMAIN_NOT_ALLOWED",
        severity: "MEDIUM",
        ipAddress: meta.ip,
        details: { siteId: dto.siteId, hostname: pageOrigin.hostname, host: pageOrigin.host },
      });
      throw new ApiException(ErrorCode.DOMAIN_NOT_ALLOWED, "Domain ini tidak diizinkan untuk widget Anda.", HttpStatus.FORBIDDEN);
    }

    const visitor = await this.conversations.getOrCreateVisitor(site.id, dto.visitorId, {
      ipHash: hashIp(meta.ip),
      userAgent: meta.userAgent,
    });

    const visitorToken = await this.visitorTokens.sign(visitor.id, site.id);
    const config = await this.getPublicConfig(site.siteKey);

    return { visitorToken, site: config, visitorDbId: visitor.id };
  }

  async ensureConversation(siteId: string, visitorId: string, context?: CreateWidgetSessionDto & { language?: string }) {
    const site = await this.prisma.site.findUniqueOrThrow({ where: { id: siteId } });
    const existing = await this.conversations.getActiveConversation(siteId, visitorId);
    if (existing) return existing;

    return this.conversations.createConversation({
      organizationId: site.organizationId,
      siteId,
      visitorId,
      context: {
        pageUrl: context?.pageUrl,
        pageTitle: context?.pageTitle,
        referrer: context?.referrer,
        utmSource: context?.utm?.source,
        utmMedium: context?.utm?.medium,
        utmCampaign: context?.utm?.campaign,
        language: context?.language ?? site.language,
      },
    });
  }

  async assertOwnership(conversationId: string, visitorId: string) {
    const conversation = await this.conversations.getConversationOrThrow(conversationId);
    if (conversation.visitorId !== visitorId) {
      await this.securityEvents.record({
        type: "CROSS_CONVERSATION_ACCESS_ATTEMPT",
        severity: "HIGH",
        details: { conversationId, visitorId },
      });
      throw new ForbiddenApiException("Anda tidak memiliki akses ke conversation ini.");
    }
    return conversation;
  }

  async identify(siteId: string, visitorId: string, identityToken: string) {
    const secret = this.config.get<string>("CUSTOMER_IDENTITY_JWT_SECRET");
    if (!secret) throw new ApiException(ErrorCode.INTERNAL_ERROR, "Identity verification belum dikonfigurasi.", HttpStatus.SERVICE_UNAVAILABLE);

    const site = await this.prisma.site.findUniqueOrThrow({ where: { id: siteId } });
    let payload: CustomerIdentityTokenPayload;
    try {
      payload = jwt.verify(identityToken, secret, {
        issuer: this.config.get<string>("CUSTOMER_IDENTITY_ISSUER"),
        audience: this.config.get<string>("CUSTOMER_IDENTITY_AUDIENCE"),
      }) as CustomerIdentityTokenPayload;
    } catch {
      throw new UnauthorizedApiException("Identity token tidak valid, kedaluwarsa, atau salah issuer/audience.");
    }

    if (payload.siteId !== site.siteKey) {
      throw new UnauthorizedApiException("Identity token tidak berlaku untuk site ini.");
    }

    const replay = await this.prisma.customerIdentity.findUnique({ where: { jti: payload.jti } });
    if (replay) throw new UnauthorizedApiException("Identity token telah digunakan sebelumnya.");

    const customer = await this.prisma.customer.upsert({
      where: { siteId_externalId: { siteId, externalId: payload.sub } },
      update: { name: payload.name, email: payload.email, accountStatus: payload.accountStatus },
      create: { siteId, externalId: payload.sub, name: payload.name, email: payload.email, accountStatus: payload.accountStatus },
    });

    await this.prisma.customerIdentity.create({
      data: {
        customerId: customer.id,
        jti: payload.jti,
        issuedAt: new Date(payload.iat * 1000),
        expiresAt: new Date(payload.exp * 1000),
      },
    });

    const activeConversation = await this.conversations.getActiveConversation(siteId, visitorId);
    if (activeConversation) {
      await this.prisma.conversation.update({ where: { id: activeConversation.id }, data: { customerId: customer.id } });
    }

    return { customerId: customer.id, name: customer.name };
  }
}
