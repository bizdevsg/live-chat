# Database (MySQL, §21, §23–§24)

Schema: `packages/database/prisma/schema.prisma`. Generator + migrations run through Prisma; the datasource is MySQL 8+ (uses `LONGTEXT`, `FULLTEXT` indexes, and JSON columns — all MySQL 8 native features, no extensions required).

## Table groups

- **Org/site**: `organizations`, `sites`, `site_domains`, `site_settings`
- **Auth/RBAC**: `users`, `roles`, `permissions`, `user_roles`, `role_permissions`, `sessions`, `password_reset_tokens`, `invitations`
- **Teams/agents**: `teams`, `team_members`, `agent_profiles`, `agent_status_history`, `working_hours`
- **Visitors/customers**: `visitors`, `customers`, `customer_identities`, `tags`, `customer_tags`
- **Conversations**: `conversations`, `conversation_participants`, `conversation_assignments`, `conversation_events`, `conversation_contexts`, `conversation_summaries`
- **Messages**: `messages`, `message_attachments`, `message_receipts`, `message_reactions`
- **Tickets**: `tickets`, `ticket_comments`, `ticket_assignments`, `ticket_events`
- **Leads**: `leads`, `lead_events`
- **Knowledge**: `knowledge_categories`, `knowledge_documents`, `knowledge_document_versions`, `knowledge_chunks`, `knowledge_tags`, `knowledge_document_tags`
- **AI**: `ai_configurations`, `ai_prompts`, `ai_runs`, `ai_messages`, `ai_tool_calls`, `ai_feedback`, `ai_usage_daily`
- **Ops**: `routing_rules`, `handoff_rules`, `response_templates`, `integrations`, `integration_credentials`, `integration_logs`, `webhooks`, `webhook_deliveries`
- **Reporting/audit**: `customer_feedback`, `analytics_daily`, `audit_logs`, `security_events`, `rate_limit_events`, `feature_flags`

## Hybrid RAG storage (§21)

`knowledge_chunks` carries a `@@fulltext([content])` index (and `knowledge_documents` a `@@fulltext([title, content])` index) plus an `embedding Json?` column storing the vector as a JSON array. Retrieval (`KnowledgeRetriever` in `packages/ai-core`) does:

1. `MATCH(content) AGAINST(? IN NATURAL LANGUAGE MODE)` to fetch ≤80 lexical candidates, filtered by `siteId`, `status = 'PUBLISHED'`, `audience`, and the effective/expiry date window — all in one indexed query.
2. Cosine similarity between the query embedding and each candidate's stored embedding, computed in Node (`packages/ai-core/src/similarity.ts`), blended 70/30 with the normalized lexical score.
3. Top 8 chunks returned as `KnowledgeEvidence[]`.

This means the full embedding table is never scanned per-query — only the FULLTEXT-narrowed candidate set is re-ranked.

## Key constraints

- `messages.clientMessageId` is unique per `conversationId` (`@@unique([conversationId, clientMessageId])`) — the mechanism behind message-retry idempotency (verified in `test/widget.e2e-spec.ts`).
- `customer_identities.jti` is globally unique — replay protection for the signed customer-identity JWT (§9).
- `knowledge_documents` are unique per `(siteId, slug)`; a re-publish of edited content increments `version` and snapshots the previous version into `knowledge_document_versions`.

## Soft delete

Only `messages.deletedAt` is soft-delete (a message can be redacted from history without breaking `clientMessageId`-based idempotency or `aiRunId` foreign keys). Everything else uses hard deletes where deletion is exposed at all — `audit_logs` and `security_events` have **no** delete endpoint anywhere in the API (§36).

## Migrations

`packages/database/prisma/migrations/` contains one migration, `<timestamp>_init`, generated via `prisma migrate dev` against a local MySQL instance and applied with `prisma migrate deploy` in CI/production (see `docs/deployment.md`).

## Backup / restore

`infrastructure/scripts/backup-mysql.sh` / `restore-mysql.sh` wrap `mysqldump`/`mysql` against the `mysql` docker-compose service (gzip-compressed dumps, `--single-transaction` for a consistent snapshot without locking). `infrastructure/mysql/my.cnf` has commented-out tuning knobs (buffer pool size, etc.) mountable into the container.
