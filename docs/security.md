# Security (§31–§33)

## Authentication & sessions

- Passwords hashed with **Argon2id** (`@node-rs/argon2`).
- JWT access tokens (15m default) + refresh tokens (30d default), both httpOnly, `SameSite=Lax` cookies. Refresh tokens are **rotated** on every use; reusing a stale refresh token revokes the entire token family (replay detection).
- Account lockout: 5 failed attempts locks the account for 15 minutes (`User.failedLoginCount` / `lockedUntil`).
- `POST /auth/logout-all` and the Admin "Revoke Sessions" action both invalidate every `Session` row for a user immediately — subsequent requests with the old cookie fail `JwtAuthGuard`'s session-revocation check even if the JWT itself hasn't expired.

## Authorization

- RBAC is DB-backed (`roles`, `permissions`, `role_permissions`, `user_roles`) — never hardcoded to the frontend. Every protected controller uses `@RequirePermissions(...)` + `PermissionsGuard`, checked against the JWT's `permissions` claim (computed at login/refresh time from the DB).
- Widget visitors never receive staff permissions; the visitor JWT (`type: "visitor"`) is a structurally distinct token, verified by a separate `VisitorAuthGuard` that only staff controllers don't use.

## Widget → API trust boundary (§8, §9)

- The browser-reported `pageUrl` is checked against the site's `SiteDomain` allowlist server-side before a session token is issued; failures are logged as `DOMAIN_NOT_ALLOWED` security events.
- IP addresses are hashed (`sha256`, truncated) before being stored on `Visitor.lastIpHash` — never stored raw.
- Authenticated-customer identity is never trusted as plain JSON from the browser. The Solid Gold main site backend signs a JWT (`CustomerIdentityTokenPayload`) containing `sub/siteId/name/email/accountStatus/jti/exp`; SolidChat verifies signature, issuer, audience, expiration, and `siteId`, and rejects a reused `jti` (replay protection, tracked in `CustomerIdentity`). No role/permission claim is ever accepted from this token.

## Sensitive data & prompt injection

- Every visitor/customer message is scanned (`common/utils/content-guard.ts`) for OTP/PIN/password-shaped content and long digit runs (`SENSITIVE_DATA_PATTERNS` in `packages/shared`) before it is persisted or shown to the AI. Matches are masked (`[DIMASKING]`) in the stored/displayed content and raise a `SENSITIVE_DATA_DETECTED` security event.
- The same message is scanned for prompt-injection phrasing (`PROMPT_INJECTION_PATTERNS`, English + Indonesian). A match forces an immediate handoff (`PROMPT_INJECTION_DETECTED`) rather than being sent to the AI provider.
- Knowledge document content is only ever included in the AI provider's prompt as a labeled "reference data" block, never as instructions — see `docs/ai-policy.md`.

## Transport & headers

- `helmet()` is applied globally; CORS is an explicit allowlist (`CORS_ALLOWED_ORIGINS`) with a rejecting callback (not a wildcard).
- Global `ThrottlerModule` (120 req/min default) plus a stricter per-route throttle on `POST /widget/session` (20/min) and message sending (30/min). The throttler guard is scoped to skip WebSocket contexts (which have their own auth) to avoid a `switchToHttp()` crash on `ws` execution contexts.
- Nginx examples in `infrastructure/nginx/` add `X-Content-Type-Options`, `X-Frame-Options` (`DENY` on the API/dashboard hosts; intentionally absent on the widget host, which is designed to be iframed), `Referrer-Policy`, and HSTS in the TLS example.

## File uploads (§33)

- MIME type is inferred from the uploaded file's magic bytes for knowledge documents (`file-type` dependency is included for this; the current extraction path validates by attempting format-specific parsing, which rejects unparseable/mismatched content).
- Storage keys are randomized (`nanoid`), never the original filename; objects live in a private MinIO bucket accessed only via short-lived presigned URLs (`StorageService.getSignedDownloadUrl`), never a public bucket.

## What's logged vs. masked

Audit logs (`AuditLogService`) recursively mask any object key matching `password`, `otp`, `pin`, `token`, `secret`, `authorization`, `apikey` (case-insensitive) before writing `before_data`/`after_data`. Raw access/refresh tokens, passwords, and full `Authorization` headers are never logged anywhere, including error logs (the global exception filter logs only the message + stack internally, and returns a generic message + `requestId` to the client).

## Encryption at rest

CRM integration credentials (`IntegrationCredential.encryptedValue`) are encrypted with AES-256-GCM (`EncryptionService`, key derived from `ENCRYPTION_KEY` via SHA-256) and are never returned in plaintext by any API response.

## Known gaps (documented, not silently skipped)

- The widget-loader's postMessage origin check uses `document.referrer` captured once at load — robust for the common case, but a page that clears `Referrer-Policy` before embedding would degrade this to `"*"` targetOrigin. A production hardening step would have `widget.js` pass a signed nonce to the iframe instead.
- No WAF/DDoS-layer is included; the nginx rate-limit zones are basic origin-based limiting, not a substitute for a CDN/WAF in front of production traffic.
- Multi-instance API deployments need a Socket.IO Redis adapter (not included) for cross-instance room delivery — see `docs/websocket.md`.
