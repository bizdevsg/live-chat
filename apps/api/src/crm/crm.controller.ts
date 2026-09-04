import { Controller, Get, Param, Query, Req, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { Public } from "../common/decorators/public.decorator";
import { CrmApiKeyGuard, type CrmRequestScope } from "./crm-api-key.guard";
import { CrmService } from "./crm.service";
import { ListCrmConversationsQueryDto } from "./dto/crm.dto";

/** Server-to-server conversation lookup for CRM, by handling agent's email. GET-only. */
@ApiTags("crm")
@Public()
@UseGuards(CrmApiKeyGuard)
@Controller("api/v1")
export class CrmController {
  constructor(private readonly crmService: CrmService) {}

  @Get("conversations")
  async listConversations(@Req() request: Request, @Query() query: ListCrmConversationsQueryDto) {
    const scope = (request as Request & { crmScope: CrmRequestScope }).crmScope;
    const data = await this.crmService.listConversationsByEmail(scope, query);
    return { success: true, data };
  }

  @Get("conversations/:conversationId")
  async getConversationDetail(@Req() request: Request, @Param("conversationId") conversationId: string) {
    const scope = (request as Request & { crmScope: CrmRequestScope }).crmScope;
    const data = await this.crmService.getConversationDetail(scope, conversationId);
    return { success: true, data };
  }
}
