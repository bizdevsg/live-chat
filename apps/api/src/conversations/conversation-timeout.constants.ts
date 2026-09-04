export const AGENT_REPLY_TIMEOUT_JOB_NAME = "agent-reply-timeout";
export const DEFAULT_AGENT_REPLY_TIMEOUT_SECONDS = 60;
export const MIN_AGENT_REPLY_TIMEOUT_SECONDS = 10;

export function getAgentReplyTimeoutJobId(conversationId: string) {
  return `${AGENT_REPLY_TIMEOUT_JOB_NAME}:${conversationId}`;
}
