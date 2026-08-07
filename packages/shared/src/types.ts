import type { AiIntent, HandoffReason, KnowledgeAudience } from "./enums";

export interface ApiErrorBody {
  success: false;
  error: {
    code: string;
    message: string;
    requestId: string;
    details?: unknown;
  };
}

export interface ApiSuccessBody<T> {
  success: true;
  data: T;
  requestId: string;
}

export interface JwtAccessPayload {
  sub: string;
  organizationId: string;
  email: string;
  roles: string[];
  permissions: string[];
  sessionId: string;
  type: "access";
}

export interface JwtRefreshPayload {
  sub: string;
  sessionId: string;
  tokenFamily: string;
  type: "refresh";
}

export interface VisitorTokenPayload {
  visitorId: string;
  siteId: string;
  type: "visitor";
}

/** Signed identity token issued by the Solid Gold main-site backend, verified by SolidChat. See docs/security.md. */
export interface CustomerIdentityTokenPayload {
  sub: string;
  siteId: string;
  name: string;
  email?: string;
  accountStatus: "active" | "inactive" | "suspended";
  iat: number;
  exp: number;
  jti: string;
  iss: string;
  aud: string;
}

export interface KnowledgeSource {
  documentId: string;
  chunkId: string;
  title: string;
  version: number;
  score: number;
}

export interface AnswerResult {
  answer: string;
  confidence: number;
  intent: AiIntent;
  sources: KnowledgeSource[];
  handoffRequired: boolean;
  handoffReason?: HandoffReason;
  tokensUsed?: number;
}

export interface ClassificationResult {
  intent: AiIntent;
  confidence: number;
  sentiment: "POSITIVE" | "NEUTRAL" | "NEGATIVE" | "ANGRY";
  containsSensitiveData: boolean;
  promptInjectionDetected: boolean;
}

export interface ConversationSummaryResult {
  customerGoal: string;
  importantFacts: string[];
  actionsTaken: string[];
  openIssues: string[];
  sensitiveDataDetected: boolean;
}

export interface SuggestedReplyResult {
  reply: string;
  sources: KnowledgeSource[];
  confidence: number;
}

export interface KnowledgeCandidateChunk {
  id: string;
  documentId: string;
  title: string;
  content: string;
  audience: KnowledgeAudience;
  version: number;
  embedding: number[] | null;
  fulltextScore: number;
}

export const WIDGET_PUBLIC_MESSAGE_TYPES = ["TEXT", "IMAGE", "FILE", "SYSTEM", "EVENT", "FORM", "QUICK_REPLY"] as const;
export const WIDGET_INTERNAL_ONLY_MESSAGE_TYPES = ["INTERNAL_NOTE", "AI_SUGGESTION"] as const;
