import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { WidgetController } from "./widget.controller";
import { WidgetService } from "./widget.service";
import { VisitorTokenService } from "./visitor-token.service";
import { VisitorAuthGuard } from "./guards/visitor-auth.guard";
import { ConversationsModule } from "../conversations/conversations.module";
import { AiModule } from "../ai/ai.module";
import { LeadsModule } from "../leads/leads.module";

@Module({
  imports: [JwtModule.register({}), ConversationsModule, AiModule, LeadsModule],
  controllers: [WidgetController],
  providers: [WidgetService, VisitorTokenService, VisitorAuthGuard],
  exports: [WidgetService, VisitorTokenService],
})
export class WidgetModule {}
