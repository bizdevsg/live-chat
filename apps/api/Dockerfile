# Build context MUST be the monorepo root: `docker build -f apps/api/Dockerfile .`
# Prisma is more reliable on Debian-based Node images than on Alpine's musl runtime.
FROM node:20-bookworm-slim AS build
RUN corepack enable && apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /repo
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY scripts ./scripts
COPY packages ./packages
COPY apps/api ./apps/api
# --prefer-frozen-lockfile, not --frozen-lockfile: install straight from pnpm-lock.yaml when it
# already matches every package.json (fast, byte-for-byte reproducible), but resolve normally
# instead of hard-failing when a dependency was just added and the lockfile hasn't caught up.
# Plain --frozen-lockfile aborts the whole build with ERR_PNPM_OUTDATED_LOCKFILE in that case,
# which forces a local `pnpm install` before Docker can build at all.
RUN set -eux; \
    attempt=1; \
    max_attempts=3; \
    until pnpm install --prefer-frozen-lockfile; do \
      if [ "$attempt" -ge "$max_attempts" ]; then \
        echo "pnpm install failed after ${max_attempts} attempts"; \
        exit 1; \
      fi; \
      echo "pnpm install failed (attempt ${attempt}/${max_attempts}); retrying in 5s..."; \
      attempt=$((attempt + 1)); \
      sleep 5; \
    done
RUN pnpm --filter @solidchat/database generate
RUN pnpm exec turbo run build --filter=@solidchat/api...

FROM node:20-bookworm-slim AS runtime
RUN corepack enable && apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates curl && rm -rf /var/lib/apt/lists/*
WORKDIR /repo
ENV NODE_ENV=production
COPY --from=build /repo ./
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -f http://localhost:4000/health/live || exit 1
CMD ["node", "apps/api/dist/main.js"]
