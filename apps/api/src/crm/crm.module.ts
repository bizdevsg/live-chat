import { Module } from "@nestjs/common";
import { CrmController } from "./crm.controller";
import { CrmService } from "./crm.service";
import { CrmApiKeyGuard } from "./crm-api-key.guard";

@Module({
  controllers: [CrmController],
  providers: [CrmService, CrmApiKeyGuard],
})
export class CrmModule {}
