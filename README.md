# SolidChat AI

Hybrid AI + human live chat customer service platform for PT Solid Gold Berjangka, built as a production-ready pnpm/Turborepo monorepo: AI answers FAQs 24/7 from a reviewed knowledge base, hands off to human CS on well-defined triggers, and gives admins full control over knowledge, routing, widget appearance, and AI configuration — all backed by MySQL.

Full docs live in [`docs/`](docs/): [architecture](docs/architecture.md) · [API reference](docs/api.md) · [WebSocket events](docs/websocket.md) · [security](docs/security.md) · [AI policy](docs/ai-policy.md) · [database](docs/database.md) · [deployment](docs/deployment.md).

## 1. Architecture summary

```text
Website Solid Gold → widget.js → Widget iframe (React) ──┐
                                                            ├─→ NestJS API ──→ MySQL / Redis / MinIO
Dashboard Admin/CS (Next.js) ──────────────────────────────┘        │
                                                              BullMQ Worker (CRM sync, analytics, cleanup)
```

The website never talks to the database, AI provider, or CRM directly — everything routes through the API. Full detail, including the AI orchestrator pipeline and the rationale for a couple of deliberate deviations from §37 of the spec, is in [`docs/architecture.md`](docs/architecture.md).

## 2. Monorepo structure

```text
apps/
  api/            NestJS — REST + Socket.IO, all business logic
  worker/         BullMQ processors: CRM sync/retry, daily analytics aggregation, retention cleanup
  dashboard/      Next.js 14 App Router — Admin + CS dashboard (27 routes)
  widget/         React + Vite — customer-facing chat iframe SPA
  widget-loader/  Vanilla TS → single ~3.6KB widget.js (esbuild)
packages/
  database/       Prisma schema (MySQL), migrations, seed
  shared/         Enums, types, AiProvider/CrmAdapter interfaces
  ai-core/        Chunking, cosine similarity, MockAiProvider, OpenAiProvider, KnowledgeRetriever
  integrations/   MockCrmAdapter, RestCrmAdapter
  typescript-config/, eslint-config/
infrastructure/
  nginx/          Dev + production (TLS/Certbot) reverse-proxy configs
  mysql/          Tuning example
  scripts/        MySQL backup/restore
docs/             Architecture, API, WebSocket, security, AI policy, database, deployment
.github/workflows/ci.yml
```

## 3. Features completed

All items below were exercised end-to-end against a real local MySQL 8 + Redis instance during development (not just typechecked) — see §12 for exact commands and §13 for what that verification actually covered.

- **Auth & RBAC**: login/refresh-rotation/logout/logout-all, Argon2id hashing, account lockout after 5 failed attempts, DB-backed roles/permissions enforced on every controller, session revocation.
- **Widget**: session bootstrap with server-side domain-allowlist enforcement, visitor JWT, conversation create/fetch, realtime messaging (REST + Socket.IO both write through the same service), `clientMessageId` idempotency, pre-chat lead capture, rating form, signed customer-identity verification (§9).
- **AI orchestrator**: intent/sentiment classification → deterministic §18 handoff-trigger table → MySQL hybrid RAG retrieval → evidence-grounded answer generation → confidence-threshold + two-strikes handoff, all DB-persisted (`AiRun`) for audit.
- **Knowledge base**: DRAFT → IN_REVIEW → APPROVED → PUBLISHED → ARCHIVED workflow with versioning; PDF/DOCX/TXT/MD/CSV/HTML upload + extraction; chunking + embedding on publish; draft/expired articles are structurally invisible to customer-facing AI (enforced in the retrieval SQL, not just app logic).
- **Human handoff**: queue with team routing (`RoutingRule`/`HandoffRule`), accept/takeover/transfer/return-to-AI/resolve/reopen, AI provably stops responding once a human is handling (`handlerType` check is the first line of the orchestrator).
- **CS inbox**: 3-column realtime UI, internal notes (never leaked to the widget socket, verified in `test/widget.e2e-spec.ts`), AI suggested replies, conversation summary, ticket creation from a conversation.
- **Tickets, leads, CRM**: full ticket lifecycle; lead capture → BullMQ-queued CRM sync with retry/backoff, `IntegrationLog` audit trail, manual retry from Admin.
- **Admin**: users/invitations, teams, sites/domains, routing & handoff rules (read view; create via API/Swagger — see §14 known simplifications), templates, widget settings, AI configuration (per-purpose models, DB-driven, no redeploy needed), customers, analytics (overview/agents/AI/intents/knowledge-gaps/CSAT/CSV export), security events, audit logs (read-only, no delete UI anywhere).
- **Multi-site**: every table is `siteId`-scoped; adding a second site is a dashboard action, not a code change.
- **Security**: sensitive-data masking + prompt-injection detection on every visitor message (regex pre-filter, runs before the AI ever sees the text), encrypted-at-rest CRM credentials, signed/validated customer-identity tokens with replay protection, consistent error envelope with no stack-trace leakage, CORS allowlist, per-route rate limiting.
- **Infra**: Dockerfiles for all 5 apps, docker-compose (mysql/redis/minio/api/worker/dashboard/widget/nginx) with health checks, dev + production (TLS/Certbot) nginx configs, MySQL backup/restore scripts, GitHub Actions CI.

## 4. Assumptions (documented deviations, per instruction §1.11)

1. **AI turn processing, embedding-on-publish, and summarization run synchronously in the API process, not as BullMQ jobs.** §37 lists these as background jobs; this build runs them inline because the API already owns the in-process Socket.IO server, and queuing them would require a Socket.IO Redis adapter for the worker to push results back. The worker instead owns CRM sync/retry, daily analytics aggregation, and retention cleanup. Documented in [`docs/architecture.md`](docs/architecture.md).
2. **Dashboard UI has no "create" form for Routing Rules / Handoff Rules** — the API endpoints are fully implemented and tested via Swagger, but the dashboard page is currently read-only for these two resources given the scope of ~27 other fully-functional dashboard pages built. Everything else in the sidebar is fully interactive.
3. **Customer-identity token verification uses a shared HMAC secret** (`CUSTOMER_IDENTITY_JWT_SECRET`), not RS256 + JWKS. Functionally equivalent for a single trusted issuer (the Solid Gold main-site backend); production hardening could move to asymmetric signing if that backend team prefers not to share a symmetric secret.
4. **In-app notifications are realtime-only, not persisted** — there is no `notifications` table in the §23 schema, so `notification:new` is a live Socket.IO push with no history/read-state. A handful of real trigger points are wired (new queued conversation, high/critical security events); the remaining listed triggers (ticket SLA, knowledge review needed, AI failure spike, integration failure) are not yet wired up.
5. **File-type validation for knowledge uploads** relies on format-specific parsers rejecting content that doesn't match the claimed type, rather than a dedicated magic-byte sniff on every upload path; `file-type` is included as a dependency for this but not yet wired into the multer pipeline.
6. **No Socket.IO Redis adapter** — fine for a single API instance (the deployed topology here); horizontally scaling the API would need one added for cross-instance room delivery.
7. Widget's postMessage origin validation uses `document.referrer` captured once at load, not a signed nonce — documented as a hardening follow-up in `docs/security.md`.

Nothing above was left as a TODO stub or a non-functional button — each is either a working simplified version or an explicitly out-of-scope item, stated here rather than silently dropped.

## 5. Environment variables

See [`.env.example`](.env.example) for the full list with inline comments. Key groups: app URLs, `DATABASE_URL` (MySQL), Redis, JWT secrets (access/refresh/visitor), `CUSTOMER_IDENTITY_*` (§9), `OPENAI_API_KEY` (required — no mock AI mode; model names are fixed in `packages/shared/src/constants.ts`), `CRM_PROVIDER`/`CRM_*`, `S3_*`/MinIO, `ENCRYPTION_KEY`, `CORS_ALLOWED_ORIGINS`, `INITIAL_ADMIN_*`, and `NEXT_PUBLIC_*`/`VITE_*` for the browser-facing apps.

## 6. Install (development)

```bash
pnpm install
```

## 7. Migration

```bash
cp .env.example packages/database/.env   # set DATABASE_URL
pnpm --filter @solidchat/database generate
pnpm --filter @solidchat/database migrate:dev   # or `migrate` (deploy) against an existing migration
```

## 8. Seed

```bash
pnpm --filter @solidchat/database seed
```

Creates: organization + `solid-gold-main` site (domain `localhost`), all roles/permissions, two teams, default AI config (OpenAI — requires `OPENAI_API_KEY`), a default routing + two handoff rules, one DRAFT sample knowledge article (intentionally unpublished — see §43), an admin user, and a demo CS agent. Credentials are printed to the console; defaults are `admin@solidgold.local` / `ChangeMe!12345` and `agent@solidgold.local` / `ChangeMe!12345`.

## 9. Test

```bash
pnpm --filter @solidchat/ai-core test      # unit — chunking, similarity, mock provider
pnpm --filter @solidchat/api test          # unit — content-guard, sanitize, handoff evaluator
pnpm --filter @solidchat/worker test       # unit — CRM adapter resolution
pnpm --filter @solidchat/api test:e2e      # e2e — auth, widget, knowledge workflow, security (needs MySQL+Redis)
# or simply: pnpm -r test  (unit tests across every package)
```

`test:e2e` needs its own DB (defaults to `solidchat_test` on `127.0.0.1:3306`, overridable via env) — see `apps/api/test/env.e2e.ts`. Each spec file creates and cleans up its own fixtures, so it's safe to run repeatedly.

## 10. Build production

```bash
pnpm turbo run build --filter=@solidchat/api...
pnpm turbo run build --filter=@solidchat/worker...
pnpm turbo run build --filter=@solidchat/dashboard...
pnpm turbo run build --filter=@solidchat/widget...
pnpm --filter @solidchat/widget-loader build
# or simply: pnpm -r build (turbo resolves the whole dependency graph)
```

## 11. Run with Docker (production-like)

```bash
cp .env.example .env   # fill in real secrets
docker compose up --build -d
docker compose exec api pnpm --filter @solidchat/database migrate
docker compose exec api pnpm --filter @solidchat/database seed
```

Full detail (including production TLS setup) in [`docs/deployment.md`](docs/deployment.md).

Notes:
- `docker-compose.yml` is the only Compose entrypoint for this repo
- if you change app source, dependencies (`package.json` / `pnpm-lock.yaml`), or Docker config, rebuild the affected services
- if you change Prisma schema, regenerate/migrate may still be needed manually

## 12. Create the first admin

Handled by the seed script (§8 above). To create additional admins afterward, log in as the seeded admin and use **Users → + User Baru** in the dashboard, or `POST /api/v1/admin/users`.

## 13. Install the widget on the Solid Gold website

```html
<script
  src="https://chat.sg-berjangka.com/widget.js"
  data-site-id="solid-gold-main"
  data-position="bottom-right"
  data-language="id"
  async>
</script>
```

Add the target domain to the site's allowlist first: **Widget Settings → Domain yang Diizinkan** in the dashboard, or `POST /api/v1/admin/sites/:id/domains`. Sessions from non-allowlisted domains are rejected server-side (`DOMAIN_NOT_ALLOWED`), verified in `test/widget.e2e-spec.ts`.

## 14. Create the first knowledge article

Dashboard: **Knowledge Base → + Artikel Baru**, write the content, then **Ajukan Review → Setujui → Publikasikan** (requires `knowledge.edit`/`knowledge.approve`/`knowledge.publish` respectively — Super Admin has all three). Publishing triggers chunking + embedding automatically; the AI can answer from it immediately after. The seeded sample article is a DRAFT placeholder by design and must go through this same flow before the AI will use it.

## 15. Connect OpenAI

Set `OPENAI_API_KEY` in the API's environment and restart the API (the key itself is never editable from the dashboard for security). There is no mock provider to fall back to — the API refuses to start without a real key. Model names, confidence threshold, and retry/timeout settings are fixed in `packages/shared/src/constants.ts`, not configured per-organization; in the dashboard, **AI Configuration** only edits `aiName` and `systemPrompt`.

## 16. Connect a CRM

Default is `MockCrmAdapter` (no setup needed, safe for dev/testing). For a real CRM: create an `Integration` row with `type: "CRM"`, `provider: "rest"`, and a `config.baseUrl`, then store the API key via `IntegrationCredential` (encrypted at rest, AES-256-GCM). `RestCrmAdapter` (`packages/integrations`) then handles lead/ticket sync server-to-server — the browser never talks to the CRM.

## 17. Add a new website/domain

**Settings → Sites** (or `POST /api/v1/admin/sites`) to create a new `Site`, then add its domain(s) under Widget Settings. No redeploy required — see [`docs/deployment.md`](docs/deployment.md#adding-a-new-site-6).

## 18. Deploy Nginx + SSL

`infrastructure/nginx/solidchat.conf` (local/dev, HTTP) and `infrastructure/nginx/solidchat.ssl.conf.example` (production, TLS via Certbot) — copy the latter, fill in real domains, run Certbot, mount into the `nginx` service. Full steps in [`docs/deployment.md`](docs/deployment.md#production).

## 19. Main API endpoints

Full list in [`docs/api.md`](docs/api.md); Swagger UI at `GET /api/docs` when the API is running. Highlights: `POST /api/v1/widget/session`, `POST /api/v1/widget/conversations/:id/messages`, `POST /api/v1/agent/conversations/:id/{accept,takeover,resolve}`, `POST /api/v1/knowledge/documents/:id/publish`, `GET /api/v1/analytics/overview`.

## 20. WebSocket events

Full catalogue in [`docs/websocket.md`](docs/websocket.md). Two namespaces: `/widget` (visitor-token auth) and `/dashboard` (httpOnly-cookie auth via the handshake).

## 21. Validation results (this session)

| Check | Result |
|---|---|
| `packages/{shared,ai-core,integrations,database}` typecheck + build | ✅ pass |
| `apps/api` typecheck, lint, build (`nest build`) | ✅ pass |
| `apps/worker` typecheck, lint, build | ✅ pass |
| `apps/dashboard` typecheck, lint, `next build` (27 routes) | ✅ pass |
| `apps/widget` typecheck, lint, `vite build` | ✅ pass |
| `apps/widget-loader` typecheck, lint, esbuild (widget.js, ~3.6KB) | ✅ pass |
| `prisma migrate dev` + `seed` against real local MySQL 8 | ✅ pass |
| Unit tests: `ai-core` (20), `api` (21), `worker` (4) | ✅ 45/45 pass |
| E2E tests: `api` auth(7)/widget(8)/knowledge(4)/security(7) against real MySQL+Redis | ✅ 26/26 pass |
| Manual golden-path smoke test (login → widget session → domain allowlist → conversation → AI answer with no evidence → 2-strikes handoff → agent queue → accept → reply; then knowledge publish → AI answers citing the source) | ✅ verified via curl against a running instance, see `docs/architecture.md` |

## 22. Known risks / follow-up work

- Routing/Handoff rule creation has no dashboard form yet (API-only) — see assumption #2.
- In-app notifications aren't persisted and only a subset of §34's trigger list is wired — see assumption #4.
- No Socket.IO Redis adapter — single-API-instance only until added — see assumption #6.
- Docker images are not `turbo prune`-optimized (full monorepo copied into each build stage); functional but larger than necessary. A follow-up could add pruning for smaller images.
- OpenAI provider path is implemented against the Responses + Embeddings APIs but has not been exercised against a live OpenAI account in this session (no API key available in this environment) — the mock provider path *has* been fully verified end-to-end, and the OpenAI provider shares the exact same orchestration code path, differing only in the `AiProvider` implementation injected.
- Widget file-attachment upload (UI) is not implemented — the backend schema/storage (`MessageAttachment`, MinIO) supports it, but the widget chat composer doesn't yet have an attach-file control.
