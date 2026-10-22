import { Module } from "@nestjs/common";
import { WahaClientService } from "./waha-client.service";
import { WhatsAppConnectionService } from "./whatsapp-connection.service";
import { WhatsAppController } from "./whatsapp.controller";
import { WhatsAppInboundService } from "./whatsapp-inbound.service";
import { WhatsAppInboxService } from "./whatsapp-inbox.service";

@Module({
  controllers: [WhatsAppController],
  providers: [WahaClientService, WhatsAppConnectionService, WhatsAppInboundService, WhatsAppInboxService],
  exports: [WahaClientService],
})
export class WhatsAppModule {}
