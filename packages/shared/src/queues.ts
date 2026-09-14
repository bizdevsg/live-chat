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

export type ConversationInactivityJobKind = "reminder" | "closing-warning" | "close";

export interface ConversationInactivityJobData {
  conversationId: string;
  activityStartedAt: string;
  kind: ConversationInactivityJobKind;
}

export type ConversationTimeoutJobData = AgentReplyTimeoutJobData | ConversationInactivityJobData;
