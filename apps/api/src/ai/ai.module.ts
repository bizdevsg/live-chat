import { Module } from "@nestjs/common";
import { ConversationsModule } from "../conversations/conversations.module";
import { KnowledgeModule } from "../knowledge/knowledge.module";
import { AiOrchestratorService } from "./ai-orchestrator.service";
import { HandoffEvaluatorService } from "./handoff-evaluator.service";
import { AiController } from "./ai.controller";
import { WhatsAppAssistantService } from "./whatsapp-assistant.service";
import { WhatsAppAssistantController } from "./whatsapp-assistant.controller";
import { WhatsAppAssistantApiKeyGuard } from "./whatsapp-assistant-api-key.guard";

@Module({
  imports: [ConversationsModule, KnowledgeModule],
  controllers: [AiController, WhatsAppAssistantController],
  providers: [AiOrchestratorService, HandoffEvaluatorService, WhatsAppAssistantService, WhatsAppAssistantApiKeyGuard],
  exports: [AiOrchestratorService],
})
export class AiModule {}
