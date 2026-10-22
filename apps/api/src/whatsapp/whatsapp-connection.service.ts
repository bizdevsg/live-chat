import { Injectable, NotFoundException } from "@nestjs/common";
import { createHash } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { WahaClientService } from "./waha-client.service";
import type { ConnectWhatsAppDto } from "./dto/whatsapp.dto";

@Injectable()
export class WhatsAppConnectionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly waha: WahaClientService,
  ) {}

  async get(organizationId: string, refresh = true) {
    const connection = await this.prisma.whatsAppConnection.findUnique({
      where: { organizationId },
      include: { site: { select: { id: true, siteKey: true, name: true } } },
    });
    if (!connection || !refresh || !this.waha.isConfigured()) return connection;

    try {
      const session = await this.waha.getSession(connection.sessionName);
      const status = this.normalizeStatus(session?.status);
      const phoneNumber = this.phoneFromWhatsAppId(session?.me?.id) ?? connection.phoneNumber;
      const updated = await this.prisma.whatsAppConnection.update({
        where: { id: connection.id },
        data: {
          status,
          phoneNumber,
          lastError: null,
          lastSeenAt: new Date(),
          ...(status === "CONNECTED" && !connection.connectedAt ? { connectedAt: new Date() } : {}),
        },
        include: { site: { select: { id: true, siteKey: true, name: true } } },
      });
      return { ...updated, displayName: session?.me?.pushName ?? null };
    } catch (error) {
      return this.prisma.whatsAppConnection.update({
        where: { id: connection.id },
        data: { status: "FAILED", lastError: error instanceof Error ? error.message : "WAHA unavailable" },
        include: { site: { select: { id: true, siteKey: true, name: true } } },
      });
    }
  }

  async connect(organizationId: string, dto: ConnectWhatsAppDto) {
    // siteId remains an internal tenant anchor for the current schema. It is not used for
    // Live Chat routing, knowledge, AI, or WhatsApp inbox behavior.
    const site = await this.prisma.site.findFirst({ where: { organizationId, isActive: true }, orderBy: { createdAt: "asc" } });
    if (!site) throw new NotFoundException("Organization belum memiliki Site aktif.");

    const sessionName = `solidchat-${createHash("sha256").update(organizationId).digest("hex").slice(0, 20)}`;
    const connection = await this.prisma.whatsAppConnection.upsert({
      where: { organizationId },
      update: { siteId: site.id, engine: dto.engine, status: "CONNECTING", lastError: null },
      create: { organizationId, siteId: site.id, sessionName, engine: dto.engine, status: "CONNECTING" },
    });

    try {
      const session = await this.waha.ensureSession(connection.sessionName, dto.engine);
      const updated = await this.prisma.whatsAppConnection.update({
        where: { id: connection.id },
        data: {
          status: this.normalizeStatus(session?.status),
          phoneNumber: this.phoneFromWhatsAppId(session?.me?.id),
          lastSeenAt: new Date(),
        },
        include: { site: { select: { id: true, siteKey: true, name: true } } },
      });
      return { ...updated, displayName: session?.me?.pushName ?? null };
    } catch (error) {
      await this.prisma.whatsAppConnection.update({
        where: { id: connection.id },
        data: { status: "FAILED", lastError: error instanceof Error ? error.message : "Gagal memulai WAHA" },
      });
      throw error;
    }
  }

  async qr(organizationId: string) {
    const connection = await this.prisma.whatsAppConnection.findUnique({ where: { organizationId } });
    if (!connection) throw new NotFoundException("Koneksi WhatsApp belum dibuat.");
    return this.waha.getQr(connection.sessionName);
  }

  async disconnect(organizationId: string) {
    const connection = await this.prisma.whatsAppConnection.findUnique({ where: { organizationId } });
    if (!connection) return null;
    await this.waha.logout(connection.sessionName);
    return this.prisma.whatsAppConnection.update({
      where: { id: connection.id },
      data: { status: "DISCONNECTED", phoneNumber: null, connectedAt: null, lastError: null },
    });
  }

  normalizeStatus(status?: string | null) {
    switch (status?.toUpperCase()) {
      case "WORKING": return "CONNECTED";
      case "SCAN_QR_CODE": return "PAIRING";
      case "STARTING": return "CONNECTING";
      case "FAILED": return "FAILED";
      case "STOPPED": return "DISCONNECTED";
      default: return status?.toUpperCase() || "CONNECTING";
    }
  }

  phoneFromWhatsAppId(value?: string | null) {
    if (!value) return null;
    const phone = value.split("@")[0]?.replace(/\D/g, "");
    return phone || null;
  }
}
