import { BullModule } from "@nestjs/bullmq";
import { Global, Module } from "@nestjs/common";
import { ClaraWebhookConfigService } from "./clara-webhook.config";
import { ClaraWebhookProcessor } from "./clara-webhook.processor";
import {
  CLARA_WEBHOOK_QUEUE,
  ClaraWebhookService,
} from "./clara-webhook.service";

@Global()
@Module({
  imports: [BullModule.registerQueue({ name: CLARA_WEBHOOK_QUEUE })],
  providers: [
    ClaraWebhookConfigService,
    ClaraWebhookService,
    ClaraWebhookProcessor,
  ],
  exports: [ClaraWebhookService],
})
export class ClaraWebhookModule {}
