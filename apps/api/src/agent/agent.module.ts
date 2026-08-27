import { Module } from "@nestjs/common";
import { AgentController } from "./agent.controller";
import { AgentService } from "./agent.service";
import { ConversationsModule } from "../conversations/conversations.module";
import { AiModule } from "../ai/ai.module";
import { LeadsModule } from "../leads/leads.module";

@Module({
  imports: [ConversationsModule, AiModule, LeadsModule],
  controllers: [AgentController],
  providers: [AgentService],
  exports: [AgentService],
})
export class AgentModule {}
