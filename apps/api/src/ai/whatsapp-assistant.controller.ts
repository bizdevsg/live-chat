import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiTags } from "@nestjs/swagger";
import { Public } from "../common/decorators/public.decorator";
import { WhatsAppAssistantReplyDto } from "./dto/ai.dto";
import { WhatsAppAssistantApiKeyGuard } from "./whatsapp-assistant-api-key.guard";
import { WhatsAppAssistantService } from "./whatsapp-assistant.service";

@ApiTags("whatsapp-assistant")
@Public()
@UseGuards(WhatsAppAssistantApiKeyGuard)
@Controller("api/v1/whatsapp-assistant")
export class WhatsAppAssistantController {
  constructor(
    private readonly config: ConfigService,
    private readonly whatsappAssistant: WhatsAppAssistantService,
  ) {}

  @Get("status")
  status() {
    return { success: true, data: { ready: true } };
  }

  @Post("reply")
  async createReply(@Body() dto: WhatsAppAssistantReplyDto) {
    const siteId = this.config.get<string>("WHATSAPP_ASSISTANT_SITE_ID");
    const data = await this.whatsappAssistant.createReply(dto, siteId);
    return { success: true, data };
  }
}
