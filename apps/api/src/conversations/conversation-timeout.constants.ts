export const AGENT_REPLY_TIMEOUT_JOB_NAME = "agent-reply-timeout";
export const CONVERSATION_INACTIVITY_JOB_NAME = "conversation-inactivity";
export const DEFAULT_AGENT_REPLY_TIMEOUT_SECONDS = 60;
export const MIN_AGENT_REPLY_TIMEOUT_SECONDS = 10;
export const AI_INACTIVITY_REMINDER_DELAY_MS = 5 * 60 * 1000;
export const AI_INACTIVITY_CLOSING_WARNING_DELAY_MS = 9 * 60 * 1000 + 40 * 1000;
export const AI_INACTIVITY_CLOSE_DELAY_MS = 10 * 60 * 1000;

export function getAgentReplyTimeoutJobId(conversationId: string) {
  // BullMQ rejects a custom job id containing ":" ("Custom Id cannot contain :"), so use "_".
  return `${AGENT_REPLY_TIMEOUT_JOB_NAME}_${conversationId}`;
}

export function getConversationInactivityJobId(conversationId: string, kind: "reminder" | "closing-warning" | "close") {
  return `${CONVERSATION_INACTIVITY_JOB_NAME}_${kind}_${conversationId}`;
}
