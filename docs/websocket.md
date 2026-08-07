# WebSocket Reference

Two Socket.IO namespaces are hosted on the same NestJS server (`apps/api`).

## `/widget` — public

**Auth**: `io(url, { auth: { visitorToken } })`. Verified in `handleConnection`; invalid/missing token disconnects immediately.

| Direction | Event | Payload | Notes |
|---|---|---|---|
| → server | `widget:join` | `{ conversationId }` | Joins `conversation:{id}` room after an ownership check |
| → server | `message:send` | `{ conversationId, content, clientMessageId? }` | Mirrors the REST endpoint; triggers the AI turn |
| → server | `message:read` | `{ conversationId, messageId }` | Persists a read receipt |
| → server | `typing:start` / `typing:stop` | `{ conversationId }` | Ephemeral, not persisted |
| → server | `agent:request` | `{ conversationId, reason? }` | |
| → server | `conversation:close` | `{ conversationId }` | |
| → server | `feedback:submit` | `{ conversationId, score, comment? }` | |
| ← server | `message:created` | `{ conversationId, message }` | Internal notes / AI suggestions are never emitted on this namespace |
| ← server | `conversation:updated` | `{ conversationId, status?, handlerType? }` | |
| ← server | `typing:updated` | `{ from: "AGENT", typing }` | |
| ← server | `queue:updated` | `{ conversationId }` | Broadcast to the `site:{id}` room |
| ← server | `error` | `{ code, message }` | |

## `/dashboard` — staff only

**Auth**: the access token is an httpOnly cookie, so it can't be read by page JS. The client connects with `io(url, { withCredentials: true })`; the server reads the token from the handshake's `Cookie` header. On connect the socket auto-joins `agent:{userId}`, `org:{organizationId}`, one `team:{id}` room per team membership, and one `site:{id}` room per site in the organization.

| Direction | Event | Payload |
|---|---|---|
| → server | `agent:status` | `{ availability: "ONLINE" \| "BUSY" \| "OFFLINE" }` |
| → server | `conversation:join` / `conversation:leave` | `{ conversationId }` (join the room for a conversation the agent has open — not in the original spec's event list, but necessary for the inbox UI to receive live updates for the conversation currently being viewed) |
| → server | `conversation:accept` / `takeover` / `return_to_ai` | `{ conversationId }` |
| → server | `conversation:transfer` | `{ conversationId, toAgentId? , toTeamId? }` |
| → server | `conversation:resolve` | `{ conversationId }` |
| → server | `message:send` | `{ conversationId, content, isInternal?, clientMessageId? }` |
| → server | `message:read` | `{ messageId }` |
| → server | `typing:start` / `typing:stop` | `{ conversationId }` |
| → server | `ticket:create` | `{ conversationId, subject, description, category }` |
| ← server | `message:created`, `conversation:updated`, `conversation:assigned`, `queue:updated`, `typing:updated`, `ticket:created`, `agent:status`, `notification:new`, `error` | |

## Rooms

`conversation:{conversationId}`, `agent:{agentId}`, `team:{teamId}`, `site:{siteId}`, `org:{organizationId}` (dashboard-only).

## Cross-process note

Both namespaces run in-process inside `apps/api` — there is currently only ever one API instance expected, so no Socket.IO Redis adapter is configured. Horizontally scaling the API to multiple instances would require adding `@socket.io/redis-adapter` so room broadcasts reach sockets connected to a different instance; this is flagged as a scaling follow-up in the README.
