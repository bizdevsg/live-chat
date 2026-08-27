import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Public } from "../common/decorators/public.decorator";
import { CrmApiKeyGuard } from "./crm-api-key.guard";
import { CrmService } from "./crm.service";
import { ListCrmConversationsDto } from "./dto/crm.dto";

@ApiTags("crm")
@Public()
@UseGuards(CrmApiKeyGuard)
@Controller("api/crm")
export class CrmController {
  constructor(private readonly crmService: CrmService) {}

  @Get(["conversessions", "conversations"])
  async listConversations(@Query() query: ListCrmConversationsDto) {
    const data = await this.crmService.listConversationsByEmail(query.email);
    return { success: true, data };
  }

  @Get(["conversessions/detail/:conversationId", "conversations/detail/:conversationId"])
  async getConversationDetail(@Param("conversationId") conversationId: string) {
    const data = await this.crmService.getConversationDetail(conversationId);
    return { success: true, data };
  }
}

