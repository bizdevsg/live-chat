export interface ConversationSummary {
  id: string;
  status: string;
  handlerType: string;
  priority: string;
  intent: string | null;
  sentiment: string | null;
  handoffReason: string | null;
  assignedAgentId: string | null;
  assignedTeamId: string | null;
  createdAt: string;
  lastMessageAt: string | null;
  ratingScore: number | null;
  context?: { pageUrl?: string | null; pageTitle?: string | null } | null;
}

export interface MessageItem {
  id: string;
  conversationId: string;
  senderType: string;
  senderId: string | null;
  messageType: string;
  content: string;
  isInternal: boolean;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface ConversationDetail {
  conversation: ConversationSummary & {
    customer?: { id: string; name: string; email: string | null } | null;
    visitor?: { id: string; visitorKey: string } | null;
  };
  messages: MessageItem[];
  summary: {
    customerGoal: string;
    importantFacts: string[];
    actionsTaken: string[];
    openIssues: string[];
  } | null;
  recentAiRuns: Array<{ id: string; purpose: string; confidence: number | null; intent: string | null; createdAt: string }>;
}
