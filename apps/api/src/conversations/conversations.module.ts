import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { QUEUE_NAMES } from "@solidchat/shared";
import { ConversationsService } from "./conversations.service";
import { ConversationTimeoutProcessor } from "./conversation-timeout.processor";

@Module({
  imports: [BullModule.registerQueue({ name: QUEUE_NAMES.CONVERSATION_TIMEOUT })],
  providers: [ConversationsService, ConversationTimeoutProcessor],
  exports: [ConversationsService],
})
export class ConversationsModule {}
