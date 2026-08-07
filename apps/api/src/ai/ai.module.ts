import { Module } from "@nestjs/common";
import { ConversationsModule } from "../conversations/conversations.module";
import { KnowledgeModule } from "../knowledge/knowledge.module";
import { AiOrchestratorService } from "./ai-orchestrator.service";
import { HandoffEvaluatorService } from "./handoff-evaluator.service";
import { AiController } from "./ai.controller";

@Module({
  imports: [ConversationsModule, KnowledgeModule],
  controllers: [AiController],
  providers: [AiOrchestratorService, HandoffEvaluatorService],
  exports: [AiOrchestratorService],
})
export class AiModule {}
