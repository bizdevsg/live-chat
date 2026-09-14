import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { ModuleRef } from "@nestjs/core";
import { QUEUE_NAMES, type ConversationInactivityJobData, type ConversationTimeoutJobData } from "@solidchat/shared";
import type { Job } from "bullmq";
import { AiOrchestratorService } from "../ai/ai-orchestrator.service";
import { AGENT_REPLY_TIMEOUT_JOB_NAME, CONVERSATION_INACTIVITY_JOB_NAME } from "./conversation-timeout.constants";
import { ConversationsService } from "./conversations.service";

@Processor(QUEUE_NAMES.CONVERSATION_TIMEOUT)
export class ConversationTimeoutProcessor extends WorkerHost {
  private readonly logger = new Logger(ConversationTimeoutProcessor.name);

  constructor(
    private readonly conversations: ConversationsService,
    private readonly moduleRef: ModuleRef,
  ) {
    super();
  }

  async process(job: Job<ConversationTimeoutJobData>): Promise<void> {
    if (job.name === CONVERSATION_INACTIVITY_JOB_NAME) {
      const inactivityJob = job.data as ConversationInactivityJobData;
      await this.conversations.handleAiInactivity(inactivityJob.conversationId, new Date(inactivityJob.activityStartedAt), inactivityJob.kind);
      return;
    }

    if (job.name !== AGENT_REPLY_TIMEOUT_JOB_NAME) return;

    const timeoutJob = job.data as Extract<ConversationTimeoutJobData, { timeoutStartedAt: string }>;
    const restored = await this.conversations.autoReturnToAiOnAgentTimeout(timeoutJob.conversationId, new Date(timeoutJob.timeoutStartedAt));
    if (restored) {
      // Answer immediately if the visitor's latest message is still hanging unanswered. Checking
      // from epoch (not the handoff moment) means a question asked *before* the handoff is picked
      // up too; the low-confidence handoff loop is still avoided because in that case the last
      // message is the AI's own answer, not the visitor's.
      if (await this.conversations.hasPendingVisitorMessageSince(job.data.conversationId, new Date(0))) {
        this.moduleRef
          .get(AiOrchestratorService, { strict: false })
          .processVisitorTurn(job.data.conversationId)
          .catch((error: unknown) => this.logger.error(error));
      }
      this.logger.log(`Conversation ${job.data.conversationId} dikembalikan ke AI karena agent tidak membalas dalam batas waktu yang ditentukan.`);
    }
  }
}
