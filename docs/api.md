# API Reference

Base path: `/api/v1`. Interactive Swagger UI is served at `GET /api/docs` when the API is running. All responses use the envelope:

```json
{ "success": true, "data": { } }
{ "success": false, "error": { "code": "STRING", "message": "Human-readable", "requestId": "req_xxx" } }
```

## Auth (`/api/v1/auth`) — public except where noted

| Method | Path | Notes |
|---|---|---|
| POST | `/login` | Sets `access_token`/`refresh_token` httpOnly cookies |
| POST | `/refresh` | Rotates refresh token; reuse of a rotated token revokes the whole session family |
| POST | `/logout` | Auth required. Revokes the current session |
| POST | `/logout-all` | Auth required. Revokes every session for the user |
| POST | `/forgot-password` | Always 200 (never reveals whether the email exists) |
| POST | `/reset-password` | Consumes a one-time token, revokes all sessions |
| GET | `/me` | Auth required. Returns profile + roles + resolved permissions |

## Widget (`/api/v1/widget`) — public, visitor-token protected past `/session`

| Method | Path | Auth |
|---|---|---|
| GET | `/config/:siteId` | none |
| POST | `/session` | none — validates domain allowlist, issues a visitor JWT |
| POST | `/conversations` | Bearer visitor token |
| GET | `/conversations/:id` | Bearer visitor token (ownership enforced) |
| POST | `/conversations/:id/messages` | Bearer visitor token |
| POST | `/conversations/:id/request-agent` | Bearer visitor token |
| POST | `/conversations/:id/close` | Bearer visitor token |
| POST | `/conversations/:id/feedback` | Bearer visitor token |
| POST | `/conversations/:id/lead` | Bearer visitor token (pre-chat form submission, §28) |
| POST | `/identify` | Bearer visitor token — verifies the signed customer-identity JWT (§9) |

## Agent (`/api/v1/agent`) — staff, `conversation.handle` permission

`GET /queue`, `GET /conversations`, `GET /conversations/:id`, `POST /conversations/:id/{accept,takeover,return-to-ai,transfer,resolve,reopen}`, `POST /conversations/:id/messages`, `POST /conversations/:id/internal-notes`, `POST /conversations/:id/suggested-reply`, `POST /conversations/:id/summary`, `POST /status`.

## Admin (`/api/v1/admin`) — staff, permission per resource

Users (`/users`, `/users/roles`, `/users/invite`, `/users/:id`, `/users/:id/revoke-sessions`), Teams (`/teams`, `/teams/:id`, `/teams/:id/members`), Sites (`/sites`, `/sites/:id`, `/sites/:id/domains`, `/sites/:id/widget-settings`), Routing (`/routing-rules`, `/handoff-rules`), Templates (`/templates`), Customers (`/customers`, `/customers/:id`), Overview (`/overview`), Audit (`/audit-logs`), Security (`/security-events`), Integrations (`/integrations`).

## Knowledge (`/api/v1/knowledge`)

`GET/POST /documents`, `GET/PUT /documents/:id`, `POST /documents/:id/{submit-review,approve,reject,publish,archive,reprocess}`, `POST /upload` (multipart), `GET /categories`.

## AI (`/api/v1/ai`)

`GET /configuration`, `PUT /configuration/:id`, `GET /runs`, `POST /runs/:id/feedback`.

## Tickets (`/api/v1/tickets`)

`GET/POST /`, `GET/PUT /:id`, `POST /:id/comments`, `POST /:id/assign`, `POST /:id/{resolve,close,reopen}`.

## Leads (`/api/v1/leads`)

`GET /`, `GET /:id`, `POST /:id/retry`.

## CRM Export (`/api/v1/conversations`)

`GET`-only, server-to-server lookup for CRM consumers, by the handling agent's email — see
[`crm-integration.md`](./crm-integration.md) for background and how this relates to "Kebutuhan
API Live Chat dan SSO Dashboard untuk Integrasi Clara" v1.1. Protected by
`Authorization: Bearer <API_KEY>` or `x-api-key`, matched against `CRM_API_KEYS` (per-site
scoped credentials, preferred) or the legacy `CRM_INBOUND_API_KEY`/`CRM_API_KEY` fallback
(unrestricted, all sites).

| Method | Path | Notes |
|---|---|---|
| GET | `/conversations?email=&site_id=` | Conversations assigned to/handled by the agent with this email. `site_id` required only if the API key can read more than one site. |
| GET | `/conversations/:conversationId` | Full conversation detail (messages, summary, tickets, leads) — internal notes and AI-suggestion drafts excluded. |

Standard `{success, data}` envelope.

## Analytics (`/api/v1/analytics`)

`GET /{overview,conversations,agents,ai,intents,knowledge-gaps,customer-satisfaction}`, `GET /export` (CSV).

## Health

`GET /health`, `GET /health/live`, `GET /health/ready` (checks MySQL + Redis).

## Error codes

`VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONVERSATION_NOT_FOUND`, `SITE_NOT_FOUND`, `DOMAIN_NOT_ALLOWED`, `RATE_LIMITED`, `CONFLICT`, `INTERNAL_ERROR`, `TOKEN_EXPIRED`, `TOKEN_INVALID`, `ACCOUNT_LOCKED`, `ACCOUNT_DISABLED`, `INVALID_CURSOR`.
