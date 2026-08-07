import { Module } from "@nestjs/common";
import { KnowledgeController } from "./knowledge.controller";
import { KnowledgeService } from "./knowledge.service";
import { RetrievalService } from "./retrieval.service";

@Module({
  controllers: [KnowledgeController],
  providers: [KnowledgeService, RetrievalService],
  exports: [KnowledgeService, RetrievalService],
})
export class KnowledgeModule {}
