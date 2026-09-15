export const QUEUE_NAMES = {
  CRM_SYNC: "crm-sync",
  ANALYTICS_AGGREGATION: "analytics-aggregation",
  CLEANUP: "cleanup",
  CONVERSATION_TIMEOUT: "conversation-timeout",
} as const;
export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

export interface CrmSyncJobData {
  leadId: string;
}

export interface AgentReplyTimeoutJobData {
  conversationId: string;
  timeoutStartedAt: string;
}

// The AI-inactivity-timeout feature (reminder/closing-warning/close jobs) was removed; this queue
// now only ever carries agent-reply-timeout jobs. Kept as an alias (rather than inlining
// AgentReplyTimeoutJobData at both call sites) so the queue's payload type has one name to change
// if another timeout job kind is added later.
export type ConversationTimeoutJobData = AgentReplyTimeoutJobData;
