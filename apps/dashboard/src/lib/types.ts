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
  customer?: { id: string; name: string; email: string | null } | null;
  leads?: Array<{ id: string; name: string; email: string | null; phone: string | null }>;
  messages?: Array<{
    id: string;
    senderType: string;
    createdAt: string;
    receipts?: MessageReceiptItem[];
  }>;
}

export interface MessageReceiptItem {
  id: string;
  readerType: string;
  readerId: string | null;
  readAt: string;
}

export interface MessageItem {
  id: string;
  conversationId: string;
  senderType: string;
  senderId: string | null;
  senderName?: string | null;
  messageType: string;
  content: string;
  isInternal: boolean;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  receipts?: MessageReceiptItem[];
}

export interface ConversationDetail {
  conversation: ConversationSummary & {
    customer?: { id: string; name: string; email: string | null } | null;
    visitor?: { id: string; visitorKey: string } | null;
    leads?: Array<{ id: string; name: string; email: string | null; phone: string | null }>;
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
