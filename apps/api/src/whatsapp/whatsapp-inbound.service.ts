import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { WhatsAppConnectionService } from "./whatsapp-connection.service";

interface WahaEvent {
  event?: string;
  session?: string;
  me?: { id?: string; pushName?: string };
  payload?: Record<string, unknown>;
}

@Injectable()
export class WhatsAppInboundService {
  private readonly logger = new Logger(WhatsAppInboundService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly connections: WhatsAppConnectionService,
  ) {}

  async handle(event: WahaEvent) {
    if (!event.session || !event.event) return;

    // Chat data and messages remain owned by WAHA's store and are read through the dedicated
    // WhatsApp inbox API. Webhooks must never create a SolidChat Live Chat conversation or
    // schedule an AI turn.
    if (event.event !== "session.status") return;

    const payload = event.payload ?? {};
    const rawStatus = this.firstString(payload.status, payload.name);
    const status = this.connections.normalizeStatus(rawStatus);
    const phoneNumber = this.connections.phoneFromWhatsAppId(event.me?.id ?? this.firstString(payload.me));
    const result = await this.prisma.whatsAppConnection.updateMany({
      where: { sessionName: event.session },
      data: {
        status,
        ...(phoneNumber ? { phoneNumber } : {}),
        lastSeenAt: new Date(),
        lastError: status === "FAILED" ? this.firstString(payload.error) ?? "WAHA session failed" : null,
        ...(status === "CONNECTED" ? { connectedAt: new Date() } : {}),
      },
    });
    if (!result.count) this.logger.warn(`Ignoring WAHA status for unknown session ${event.session}`);
  }

  private firstString(...values: unknown[]) {
    return values.find((value): value is string => typeof value === "string" && value.trim().length > 0);
  }
}
