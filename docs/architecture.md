# Arsitektur SolidChat AI

## Ringkasan

SolidChat AI adalah sistem live chat customer service hybrid (AI + manusia) untuk PT Solid Gold Berjangka, dibangun sebagai monorepo pnpm/Turborepo. Website utama Solid Gold **tidak pernah** berkomunikasi langsung dengan database, AI provider, atau CRM — semua komunikasi melewati backend SolidChat.

```text
Website Solid Gold (sg-berjangka.com)
        │  widget.js (loader, ~3.6KB)
        ▼
Widget Iframe App (chat.sg-berjangka.com)      Dashboard Admin/CS (cs-chat.sg-berjangka.com)
        │  REST + Socket.IO (/widget)                  │  REST + Socket.IO (/dashboard)
        └──────────────────┬───────────────────────────┘
                            ▼
                 NestJS API (api-chat.sg-berjangka.com)
        ┌───────────────────┼──────────────────────────┐
        │  Conversations · AI Orchestrator · Knowledge  │
        │  Handoff · Tickets · Leads/CRM · Analytics    │
        └───────────────────┬──────────────────────────┘
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
            MySQL          Redis          MinIO (S3)
                             │
                             ▼
                     BullMQ Worker
              (CRM sync, analytics aggregation, cleanup)
```

## Apps

| App | Stack | Purpose |
|---|---|---|
| `apps/api` | NestJS 10, Prisma, Socket.IO | REST API + WebSocket gateways, all business logic |
| `apps/worker` | NestJS (no HTTP), BullMQ | Background jobs: CRM sync/retry, daily analytics aggregation, retention cleanup |
| `apps/dashboard` | Next.js 14 App Router | Admin + CS dashboard |
| `apps/widget` | React + Vite (SPA) | Customer-facing chat iframe |
| `apps/widget-loader` | Vanilla TS, esbuild IIFE | `widget.js` — the single script embedded on the Solid Gold site |

## Packages

| Package | Purpose |
|---|---|
| `packages/database` | Prisma schema (MySQL), migrations, seed script, generated client re-export |
| `packages/shared` | Cross-app enums, types, constants, the `AiProvider`/`CrmAdapter` interfaces |
| `packages/ai-core` | Provider-agnostic AI logic: chunking, cosine similarity, `OpenAiProvider`, `KnowledgeRetriever` (the MySQL hybrid RAG adapter). `MockAiProvider` also lives here for unit tests only — `AiProviderFactory` never selects it; the app always runs on real OpenAI. |
| `packages/integrations` | `MockCrmAdapter`, `RestCrmAdapter` implementing `CrmAdapter` |
| `packages/typescript-config`, `packages/eslint-config` | Shared tooling config |

All four logic packages compile to `dist/` (CommonJS) via `tsc`; apps consume the compiled output like any npm dependency. This is required for portability — Node cannot `require()` raw `.ts` source directly at runtime (see "Why packages compile to dist" below).

## AI Orchestrator pipeline (§16)

Implemented in `apps/api/src/ai/ai-orchestrator.service.ts`, triggered after every visitor message when `conversation.handlerType === 'AI'`:

```text
Visitor message saved (sanitized + sensitive-data masked)
  → Intent + sentiment classification (AiProvider.classifyIntent)
  → Deterministic handoff-trigger check (HandoffEvaluatorService, §18 keyword/intent rules)
       └─ if triggered → transitional message + requestAgent() + summarize() → stop
  → Knowledge retrieval (KnowledgeRetriever: MySQL FULLTEXT candidates → cosine re-rank)
  → Answer generation (AiProvider.generateAnswer, evidence-grounded, never fabricates)
  → Post AI message, record AiRun (tokens/latency/confidence/intent)
  → If handoffRequired or confidence < threshold → immediate requestAgent() (KNOWLEDGE_INSUFFICIENT / LOW_CONFIDENCE)
```

**Architectural deviation from §37**: AI response generation, knowledge embedding on publish, and conversation summarization run **synchronously inside the API request path**, not as BullMQ jobs. This was a deliberate simplification — the API process already holds the Socket.IO server in-process, so running AI turns inline avoids cross-process socket relay (which would otherwise require a Redis Socket.IO adapter) and keeps end-to-end latency lower for a chat product where the visitor is actively waiting. The worker instead owns genuinely decoupled background work: CRM sync/retry, daily analytics rollups, and retention cleanup. If AI call volume grows enough to threaten the API's request-handling capacity, the fix is to extract `AiOrchestratorService` and `KnowledgeRetriever` into a package consumable by the worker too, and switch to a queued flow — the `AiProvider`/`CrmAdapter` interfaces already make the provider swap-safe; only the transport (in-process vs. queued) would change.

## Realtime (Socket.IO)

Two namespaces on the same NestJS server: `/widget` (public, visitor-token auth via handshake) and `/dashboard` (staff, JWT access-token auth — read from the httpOnly cookie via the handshake's `Cookie` header, since the token is intentionally not readable by page JS). See `docs/websocket.md` for the full event catalogue. A `RealtimeEmitterService` lets any backend service broadcast without importing a concrete Gateway, avoiding circular DI.

## Multi-site (§6)

Every conversation, visitor, customer, knowledge document, and configuration row is scoped by `siteId`. The seed creates one site (`solid-gold-main`); adding a second site (e.g., `solid-gold-mobile`) requires no code changes — only a new `Site` + `SiteDomain` + `SiteSettings` + `AiConfiguration` row via the Admin dashboard.

## Why packages compile to `dist`

Early in development, `packages/*` shipped `"main": "./src/index.ts"` and were consumed directly as TypeScript source (common in monorepos that only ever run through a bundler/ts-node). This broke when running the **compiled** API with plain `node dist/main.js`: Node's module resolution follows `main` to the `.ts` file, and modern Node (22.6+) natively attempts to execute `.ts` files it's asked to `require()` — but its extension-resolution rules for that path are stricter than TypeScript's own classic resolution, so extensionless relative imports inside the package (`export * from "./chunking"`) fail with `ERR_MODULE_NOT_FOUND`. The fix (already applied): every logic package has a real `tsc` build step and `main`/`types` point at `dist/index.js` / `dist/index.d.ts`, exactly like a normal published npm package. `turbo.json`'s `dependsOn: ["^build"]` means `turbo run build --filter=@solidchat/api...` builds dependency packages first automatically; the Dockerfiles use this filter syntax for the same reason.

## Data flow ownership

- **Website Solid Gold → Widget**: only via `widget.js` + the iframe's REST/WS calls. No direct DB/AI/CRM access.
- **Widget → API**: REST for request/response actions, WebSocket for realtime push. Both are backed by the same `ConversationsService`, so either path produces identical, consistent state.
- **API → CRM**: server-to-server only (`CrmAdapter`), queued through BullMQ (`crm-sync` queue) with retry/backoff and an `IntegrationLog` audit trail.
- **API → AI provider**: server-to-server only; OpenAI API key never reaches the browser.
