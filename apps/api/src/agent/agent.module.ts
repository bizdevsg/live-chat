import { Module } from "@nestjs/common";
import { AgentController } from "./agent.controller";
import { AgentService } from "./agent.service";
import { ConversationsModule } from "../conversations/conversations.module";
import { AiModule } from "../ai/ai.module";

@Module({
  imports: [ConversationsModule, AiModule],
  controllers: [AgentController],
  providers: [AgentService],
})
export class AgentModule {}
