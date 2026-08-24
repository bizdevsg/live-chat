import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { RealtimeEmitterService } from "../../realtime/realtime-emitter.service";

export type SitePresenceStatus = "ONLINE" | "BUSY" | "OFFLINE";

/**
 * Aggregates individual agent availability (AgentProfile.availability) into a single
 * live-chat presence status per organization, and pushes it to every site the org owns so
 * the widget can decide whether to offer live chat or fall back to a ticket form.
 */
@Injectable()
export class PresenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeEmitterService,
  ) {}

  async computeOrgPresence(organizationId: string): Promise<SitePresenceStatus> {
    const profiles = await this.prisma.agentProfile.findMany({
      where: { user: { organizationId, isActive: true } },
      select: { availability: true },
    });

    if (profiles.some((p) => p.availability === "ONLINE")) return "ONLINE";
    if (profiles.some((p) => p.availability === "BUSY")) return "BUSY";
    return "OFFLINE";
  }

  /** Recomputes presence for an organization and pushes it live to every one of its sites. */
  async broadcastPresence(organizationId: string): Promise<SitePresenceStatus> {
    const status = await this.computeOrgPresence(organizationId);
    const sites = await this.prisma.site.findMany({ where: { organizationId }, select: { id: true } });
    for (const site of sites) {
      this.realtime.toSite(site.id, "site:presence", { status });
    }
    return status;
  }
}
