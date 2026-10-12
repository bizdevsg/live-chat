import { Module } from "@nestjs/common";
import { KnowledgeController } from "./knowledge.controller";
import { KnowledgeService } from "./knowledge.service";
import { RetrievalService } from "./retrieval.service";
import { PublicKnowledgeController } from "./public-knowledge.controller";
import { PublicKnowledgeApiKeyGuard } from "./public-knowledge-api-key.guard";

@Module({
  controllers: [KnowledgeController, PublicKnowledgeController],
  providers: [KnowledgeService, RetrievalService, PublicKnowledgeApiKeyGuard],
  exports: [KnowledgeService, RetrievalService],
})
export class KnowledgeModule {}
