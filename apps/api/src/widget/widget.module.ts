import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { WidgetController } from "./widget.controller";
import { WidgetService } from "./widget.service";
import { VisitorTokenService } from "./visitor-token.service";
import { VisitorAuthGuard } from "./guards/visitor-auth.guard";
import { ConversationsModule } from "../conversations/conversations.module";
import { AiModule } from "../ai/ai.module";
import { LeadsModule } from "../leads/leads.module";
import { TicketsModule } from "../tickets/tickets.module";
import { WidgetRateLimitService } from "./widget-rate-limit.service";

@Module({
  imports: [JwtModule.register({}), ConversationsModule, AiModule, LeadsModule, TicketsModule],
  controllers: [WidgetController],
  providers: [WidgetService, WidgetRateLimitService, VisitorTokenService, VisitorAuthGuard],
  exports: [WidgetService, VisitorTokenService],
})
export class WidgetModule {}
