import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { QUEUE_NAMES } from "@solidchat/shared";
import { LeadsController } from "./leads.controller";
import { LeadsService } from "./leads.service";
import { CrmProviderFactory } from "./crm-provider.factory";

@Module({
  imports: [BullModule.registerQueue({ name: QUEUE_NAMES.CRM_SYNC })],
  controllers: [LeadsController],
  providers: [LeadsService, CrmProviderFactory],
  exports: [LeadsService],
})
export class LeadsModule {}
