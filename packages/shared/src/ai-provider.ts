import type { AiIntent, KnowledgeAudience } from "./enums";
import type {
  AnswerResult,
  ClassificationResult,
  ConversationSummaryResult,
  SuggestedReplyResult,
} from "./types";

export interface ChatTurn {
  senderType: "VISITOR" | "CUSTOMER" | "AI" | "AGENT" | "SYSTEM";
  content: string;
  createdAt: string;
}

export interface ClassificationInput {
  message: string;
  history: ChatTurn[];
  language: string;
}

export interface KnowledgeEvidence {
  chunkId: string;
  documentId: string;
  title: string;
  version: number;
  content: string;
  audience: KnowledgeAudience;
}

export interface AnswerInput {
  message: string;
  history: ChatTurn[];
  language: string;
  intent: AiIntent;
  evidence: KnowledgeEvidence[];
  aiName: string;
  /** Verified customer identity, if the widget has associated the visitor with a customer. */
  customerName?: string | null;
  organizationName: string;
  systemPrompt?: string | null;
}

export interface SummaryInput {
  history: ChatTurn[];
  language: string;
}

export interface SuggestedReplyInput {
  history: ChatTurn[];
  language: string;
  evidence: KnowledgeEvidence[];
  aiName: string;
  agentName: string;
  organizationName: string;
  systemPrompt?: string | null;
  agentDraft?: string;
}

export interface EmbeddingInput {
  text: string;
}

/**
 * Provider-agnostic AI interface. Business logic (AiOrchestrator) depends only on this,
 * never on a concrete SDK, so providers can be swapped via AI_PROVIDER env var.
 */
export interface AiProvider {
  readonly name: string;
  classifyIntent(input: ClassificationInput): Promise<ClassificationResult>;
  generateAnswer(input: AnswerInput): Promise<AnswerResult>;
  summarizeConversation(input: SummaryInput): Promise<ConversationSummaryResult>;
  generateSuggestedReply(input: SuggestedReplyInput): Promise<SuggestedReplyResult>;
  createEmbedding(input: EmbeddingInput): Promise<number[]>;
}

export interface CrmCustomerResult {
  crmCustomerId: string;
  name: string;
  email?: string;
  phone?: string;
  accountStatus?: string;
}

export interface FindCustomerInput {
  email?: string;
  phone?: string;
  externalId?: string;
}

export interface CreateLeadInput {
  siteId: string;
  name: string;
  email?: string;
  phone?: string;
  city?: string;
  purpose?: string;
  productInterest?: string;
  consentGiven: boolean;
  source: string;
}

export interface CreateLeadResult {
  crmLeadId: string;
}

export interface CreateCrmTicketInput {
  ticketNumber: string;
  subject: string;
  description: string;
  customerEmail?: string;
}

export interface CreateTicketResult {
  crmTicketId: string;
}

export interface UpdateLeadInput {
  crmLeadId: string;
  status?: string;
  notes?: string;
}

/** Server-to-server CRM integration boundary. The browser/widget never calls the CRM directly. */
export interface CrmAdapter {
  readonly name: string;
  findCustomer(input: FindCustomerInput): Promise<CrmCustomerResult | null>;
  createLead(input: CreateLeadInput): Promise<CreateLeadResult>;
  createTicket(input: CreateCrmTicketInput): Promise<CreateTicketResult>;
  updateLead(input: UpdateLeadInput): Promise<void>;
}
