import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { ConversationsModule } from "../conversations/conversations.module";
import { AiModule } from "../ai/ai.module";
import { TicketsModule } from "../tickets/tickets.module";
import { WidgetModule } from "../widget/widget.module";
import { WidgetGateway } from "./widget.gateway";
import { DashboardGateway } from "./dashboard.gateway";

@Module({
  imports: [JwtModule.register({}), ConversationsModule, AiModule, TicketsModule, WidgetModule],
  providers: [WidgetGateway, DashboardGateway],
})
export class RealtimeModule {}
