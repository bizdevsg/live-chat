# Build context MUST be the monorepo root: `docker build -f apps/dashboard/Dockerfile .`
# Prisma is more reliable on Debian-based Node images than Alpine musl.
FROM node:20-bookworm-slim AS build
RUN corepack enable && apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /repo
ARG NEXT_PUBLIC_API_URL=http://localhost:4000
ARG NEXT_PUBLIC_WIDGET_URL=http://localhost:3001
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_WIDGET_URL=$NEXT_PUBLIC_WIDGET_URL
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY scripts ./scripts
COPY packages ./packages
COPY apps/dashboard ./apps/dashboard
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
RUN pnpm exec turbo run build --filter=@solidchat/dashboard...

FROM node:20-bookworm-slim AS runtime
RUN corepack enable && apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /repo
ENV NODE_ENV=production
COPY --from=build /repo ./
WORKDIR /repo/apps/dashboard
EXPOSE 3000
CMD ["pnpm", "exec", "next", "start", "-p", "3000"]
