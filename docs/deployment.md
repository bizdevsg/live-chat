# Deployment

## Local development (no Docker)

Requires: Node 20+, pnpm (via `corepack enable`), a local MySQL 8 server, and a local Redis server.

```bash
pnpm install

# create the database + a dedicated user (adjust credentials as needed)
mysql -u root -e "CREATE DATABASE solidchat CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  CREATE USER 'solidchat'@'%' IDENTIFIED BY 'change_me'; GRANT ALL PRIVILEGES ON solidchat.* TO 'solidchat'@'%';"

cp .env.example apps/api/.env        # then fill in DATABASE_URL, JWT secrets, etc.
cp .env.example packages/database/.env

pnpm --filter @solidchat/shared build
pnpm --filter @solidchat/database generate
pnpm --filter @solidchat/database migrate:dev   # first run: creates the initial migration
pnpm --filter @solidchat/ai-core build
pnpm --filter @solidchat/integrations build
pnpm --filter @solidchat/database build
pnpm --filter @solidchat/database seed

pnpm --filter @solidchat/api dev        # http://localhost:4000
pnpm --filter @solidchat/worker dev
pnpm --filter @solidchat/dashboard dev  # http://localhost:3000
pnpm --filter @solidchat/widget dev     # http://localhost:3001
pnpm --filter @solidchat/widget-loader dev
```

> **Why the manual package build order**: `packages/shared`, `ai-core`, `integrations`, and `database` compile to `dist/` and are consumed like normal npm packages (see `docs/architecture.md#why-packages-compile-to-dist`). Running any app with `pnpm --filter <app> dev` before its dependency packages have been built will fail to resolve `@solidchat/*` imports. Once built once, `nest start --watch` / `next dev` / `vite` all pick up changes to the *app* incrementally; changes inside a `packages/*` file require re-running that package's `build` (or `pnpm turbo run build --filter=@solidchat/api...` to rebuild the whole dependency chain in the right order).

## Docker Compose (full stack)

```bash
cp .env.example .env   # fill in real secrets — docker-compose reads this file
docker compose up --build -d
docker compose exec api pnpm --filter @solidchat/database migrate
docker compose exec api pnpm --filter @solidchat/database seed
```

Services: `mysql`, `redis`, `minio`, `api` (:4000), `worker`, `dashboard` (:3000), `widget` (:3001, serves both the chat SPA and `/widget.js`), `nginx` (:80, reverse-proxies the subdomain topology — see `infrastructure/nginx/solidchat.conf`).

## Docker Compose (development with hot reload)

If you want every app to stay inside Docker but still pick up code edits without rebuilding on each change, use the dev override:

```bash
cp .env.example .env
docker compose -f docker-compose.dev.yml up --build
docker compose -f docker-compose.dev.yml exec api pnpm --filter @solidchat/database migrate
docker compose -f docker-compose.dev.yml exec api pnpm --filter @solidchat/database seed
```

What this changes:
- `api` and `worker` run `nest start --watch`
- `dashboard` runs `next dev`
- `widget` runs `vite`
- `widget-loader` rebuilds `widget.js` in watch mode
- nginx switches to `infrastructure/nginx/solidchat.dev.conf`, which proxies to the dev servers and serves the watched `widget.js`
- the stack is standalone and uses the Docker project name `solidchat-ai-dev`, so it is isolated from the production-like stack

Direct local ports in this mode:
- dashboard: `http://localhost:5276`
- api: `http://localhost:4400`
- widget iframe app: `http://localhost:3101`
- phpMyAdmin: `http://localhost:8082`
- MinIO API: `http://localhost:9100`
- MinIO Console: `http://localhost:9101`
- nginx: `http://localhost:8088`
- MySQL host port: `3308`

Rebuild is still required when:
- dependencies change (`package.json` / `pnpm-lock.yaml`)
- Dockerfiles or compose files change
- you intentionally want a clean image refresh

## Production

1. Point real DNS at your host for `chat.<domain>`, `api-chat.<domain>`, `cs-chat.<domain>`.
2. Copy `infrastructure/nginx/solidchat.ssl.conf.example` → `infrastructure/nginx/solidchat.ssl.conf`, fill in the real domains, and mount it instead of `solidchat.conf` in `docker-compose.yml`'s `nginx` service.
3. Obtain certificates: `sudo certbot certonly --nginx -d chat.<domain> -d api-chat.<domain> -d cs-chat.<domain>` (see the comment block at the top of the `.ssl.conf.example` file). Certbot's own renewal hook reloads nginx automatically.
4. Set every `.env` secret to a strong, unique value — `ENCRYPTION_KEY`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `VISITOR_TOKEN_SECRET`, `CUSTOMER_IDENTITY_JWT_SECRET`, MySQL/MinIO passwords. Never reuse the `.env.example` placeholder values.
5. Set `NODE_ENV=production`, real `CORS_ALLOWED_ORIGINS` (the three production hostnames, not localhost), and `OPENAI_API_KEY` + `AI_PROVIDER=openai` once you're ready to move off the mock provider.
6. `docker compose up --build -d`, then run migrations (`prisma migrate deploy`, not `migrate dev`) and the initial admin seed.
7. Configure DB and MinIO backups (`infrastructure/scripts/backup-mysql.sh` on a cron; MinIO has its own bucket versioning/replication options not configured here).

## CI (`.github/workflows/ci.yml`)

Spins up MySQL 8.4 + Redis 7 service containers, then: install → `prisma generate` → `prisma migrate deploy` → lint (`pnpm -r lint`) → typecheck (`pnpm -r typecheck`) → build (`pnpm -r build`, respects the turbo dependency graph) → unit tests (`pnpm -r test`) → API e2e tests (`pnpm --filter @solidchat/api test:e2e`).

## First admin account

The seed script (`packages/database/prisma/seed.ts`) creates an initial Super Admin from `INITIAL_ADMIN_EMAIL` / `INITIAL_ADMIN_NAME` / `INITIAL_ADMIN_PASSWORD` (defaults to `admin@solidgold.local` / `ChangeMe!12345` if unset — **change this immediately in any non-local environment**) and a demo CS agent (`agent@solidgold.local`). Both passwords should be rotated via the dashboard's reset-password flow before going live.

## Adding a new site (§6)

No redeploy needed: Admin → Widget/Sites → create a `Site` with a unique `siteKey`, add its allowed domain(s), and an `AiConfiguration` row (or let it inherit the organization-level one). The same `widget.js` build serves every site — the `data-site-id` attribute on the embed script selects which one.
