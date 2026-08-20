export const ConversationStatus = {
  NEW: "NEW",
  AI_ACTIVE: "AI_ACTIVE",
  WAITING_AGENT: "WAITING_AGENT",
  QUEUED: "QUEUED",
  AGENT_ASSIGNED: "AGENT_ASSIGNED",
  AGENT_ACTIVE: "AGENT_ACTIVE",
  WAITING_CUSTOMER: "WAITING_CUSTOMER",
  WAITING_INTERNAL: "WAITING_INTERNAL",
  RESOLVED: "RESOLVED",
  CLOSED: "CLOSED",
  SPAM: "SPAM",
  BLOCKED: "BLOCKED",
} as const;
export type ConversationStatus = (typeof ConversationStatus)[keyof typeof ConversationStatus];

export const HandlerType = {
  AI: "AI",
  HUMAN: "HUMAN",
  NONE: "NONE",
} as const;
export type HandlerType = (typeof HandlerType)[keyof typeof HandlerType];

export const Priority = {
  LOW: "LOW",
  NORMAL: "NORMAL",
  HIGH: "HIGH",
  URGENT: "URGENT",
} as const;
export type Priority = (typeof Priority)[keyof typeof Priority];

export const MessageType = {
  TEXT: "TEXT",
  IMAGE: "IMAGE",
  FILE: "FILE",
  SYSTEM: "SYSTEM",
  EVENT: "EVENT",
  INTERNAL_NOTE: "INTERNAL_NOTE",
  AI_SUGGESTION: "AI_SUGGESTION",
  FORM: "FORM",
  QUICK_REPLY: "QUICK_REPLY",
} as const;
export type MessageType = (typeof MessageType)[keyof typeof MessageType];

export const SenderType = {
  VISITOR: "VISITOR",
  CUSTOMER: "CUSTOMER",
  AI: "AI",
  AGENT: "AGENT",
  SYSTEM: "SYSTEM",
} as const;
export type SenderType = (typeof SenderType)[keyof typeof SenderType];

export const KnowledgeStatus = {
  ACTIVE: "ACTIVE",
  NON_ACTIVE: "NON_ACTIVE",
  DRAFT: "DRAFT",
  IN_REVIEW: "IN_REVIEW",
  APPROVED: "APPROVED",
  PUBLISHED: "PUBLISHED",
  EXPIRED: "EXPIRED",
  ARCHIVED: "ARCHIVED",
  REJECTED: "REJECTED",
} as const;
export type KnowledgeStatus = (typeof KnowledgeStatus)[keyof typeof KnowledgeStatus];

export const KnowledgeAudience = {
  PUBLIC: "PUBLIC",
  AGENT_ONLY: "AGENT_ONLY",
  INTERNAL: "INTERNAL",
} as const;
export type KnowledgeAudience = (typeof KnowledgeAudience)[keyof typeof KnowledgeAudience];

export const TicketStatus = {
  OPEN: "OPEN",
  IN_PROGRESS: "IN_PROGRESS",
  WAITING_CUSTOMER: "WAITING_CUSTOMER",
  WAITING_INTERNAL: "WAITING_INTERNAL",
  RESOLVED: "RESOLVED",
  CLOSED: "CLOSED",
  REOPENED: "REOPENED",
} as const;
export type TicketStatus = (typeof TicketStatus)[keyof typeof TicketStatus];

export const AssignmentStrategy = {
  ROUND_ROBIN: "ROUND_ROBIN",
  LEAST_ACTIVE: "LEAST_ACTIVE",
  MANUAL: "MANUAL",
  SKILL_BASED: "SKILL_BASED",
  PRIORITY_BASED: "PRIORITY_BASED",
} as const;
export type AssignmentStrategy = (typeof AssignmentStrategy)[keyof typeof AssignmentStrategy];

export const AgentAvailability = {
  ONLINE: "ONLINE",
  BUSY: "BUSY",
  OFFLINE: "OFFLINE",
} as const;
export type AgentAvailability = (typeof AgentAvailability)[keyof typeof AgentAvailability];

/** System role slugs. Roles/permissions live in the DB (seeded); this is a stable reference for code that needs to special-case a role. */
export const SystemRole = {
  SUPER_ADMIN: "super_admin",
  ADMIN: "admin",
  SUPERVISOR: "supervisor",
  CS_AGENT: "cs_agent",
  KNOWLEDGE_EDITOR: "knowledge_editor",
  AUDITOR: "auditor",
} as const;
export type SystemRole = (typeof SystemRole)[keyof typeof SystemRole];

/** Granular permission slugs, seeded into the `permissions` table and attached to roles via `role_permissions`. */
export const Permission = {
  ORG_MANAGE: "org.manage",
  SITE_MANAGE: "site.manage",
  INTEGRATION_MANAGE: "integration.manage",
  SECURITY_MANAGE: "security.manage",
  AUDIT_LOG_VIEW: "audit_log.view",
  USER_MANAGE: "user.manage",
  ROLE_MANAGE: "role.manage",
  TEAM_MANAGE: "team.manage",
  KNOWLEDGE_EDIT: "knowledge.edit",
  KNOWLEDGE_APPROVE: "knowledge.approve",
  KNOWLEDGE_PUBLISH: "knowledge.publish",
  AI_CONFIG_MANAGE: "ai_config.manage",
  ROUTING_MANAGE: "routing.manage",
  TEMPLATE_MANAGE: "template.manage",
  WIDGET_MANAGE: "widget.manage",
  ANALYTICS_VIEW: "analytics.view",
  CONVERSATION_VIEW_ALL: "conversation.view_all",
  CONVERSATION_VIEW_TEAM: "conversation.view_team",
  CONVERSATION_HANDLE: "conversation.handle",
  CONVERSATION_TAKEOVER: "conversation.takeover",
  CONVERSATION_TRANSFER: "conversation.transfer",
  TICKET_MANAGE: "ticket.manage",
  CUSTOMER_VIEW: "customer.view",
  LEAD_VIEW: "lead.view",
} as const;
export type Permission = (typeof Permission)[keyof typeof Permission];

export const AiIntent = {
  GENERAL_INQUIRY: "GENERAL_INQUIRY",
  ACCOUNT_REGISTRATION: "ACCOUNT_REGISTRATION",
  DEPOSIT: "DEPOSIT",
  WITHDRAWAL: "WITHDRAWAL",
  FEES: "FEES",
  TRADING_PLATFORM: "TRADING_PLATFORM",
  MOBILE_APP: "MOBILE_APP",
  SECURITY: "SECURITY",
  COMPLAINT: "COMPLAINT",
  BRANCH_INFO: "BRANCH_INFO",
  RISK_DISCLOSURE: "RISK_DISCLOSURE",
  HUMAN_REQUEST: "HUMAN_REQUEST",
  SENSITIVE_DATA: "SENSITIVE_DATA",
  OTHER: "OTHER",
} as const;
export type AiIntent = (typeof AiIntent)[keyof typeof AiIntent];

export const HandoffReason = {
  CUSTOMER_REQUESTED_HUMAN: "CUSTOMER_REQUESTED_HUMAN",
  DEPOSIT_ISSUE: "DEPOSIT_ISSUE",
  WITHDRAWAL_ISSUE: "WITHDRAWAL_ISSUE",
  TRANSACTION_DISPUTE: "TRANSACTION_DISPUTE",
  LOGIN_ISSUE: "LOGIN_ISSUE",
  ACCOUNT_LOCKED: "ACCOUNT_LOCKED",
  PERSONAL_DATA_CHANGE: "PERSONAL_DATA_CHANGE",
  DOCUMENT_VERIFICATION: "DOCUMENT_VERIFICATION",
  SENSITIVE_DATA_DETECTED: "SENSITIVE_DATA_DETECTED",
  SUSPECTED_FRAUD: "SUSPECTED_FRAUD",
  SERIOUS_COMPLAINT: "SERIOUS_COMPLAINT",
  LEGAL_THREAT: "LEGAL_THREAT",
  ANGRY_CUSTOMER: "ANGRY_CUSTOMER",
  AI_FAILED_TWICE: "AI_FAILED_TWICE",
  KNOWLEDGE_INSUFFICIENT: "KNOWLEDGE_INSUFFICIENT",
  LOW_CONFIDENCE: "LOW_CONFIDENCE",
  ACCOUNT_DATA_REQUIRED: "ACCOUNT_DATA_REQUIRED",
  PERSONAL_TRADING_DECISION: "PERSONAL_TRADING_DECISION",
  BUY_SELL_REQUEST: "BUY_SELL_REQUEST",
  PROFIT_GUARANTEE_REQUEST: "PROFIT_GUARANTEE_REQUEST",
  SECURITY_RISK: "SECURITY_RISK",
  PROMPT_INJECTION_DETECTED: "PROMPT_INJECTION_DETECTED",
} as const;
export type HandoffReason = (typeof HandoffReason)[keyof typeof HandoffReason];

export const ErrorCode = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  CONVERSATION_NOT_FOUND: "CONVERSATION_NOT_FOUND",
  SITE_NOT_FOUND: "SITE_NOT_FOUND",
  DOMAIN_NOT_ALLOWED: "DOMAIN_NOT_ALLOWED",
  RATE_LIMITED: "RATE_LIMITED",
  CONFLICT: "CONFLICT",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  TOKEN_EXPIRED: "TOKEN_EXPIRED",
  TOKEN_INVALID: "TOKEN_INVALID",
  ACCOUNT_LOCKED: "ACCOUNT_LOCKED",
  ACCOUNT_DISABLED: "ACCOUNT_DISABLED",
} as const;
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];
