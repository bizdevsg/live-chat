# Build context MUST be the monorepo root: `docker build -f apps/widget/Dockerfile .`
# Produces a single static nginx image serving both the widget iframe app (chat SPA) and
# widget.js (the loader) from the same origin, matching §42's "chat.sg-berjangka.com" host.
# Prisma workspace dependencies are more stable on Debian-based Node images.
FROM node:20-bookworm-slim AS build
RUN corepack enable && apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /repo
ARG VITE_API_URL=http://localhost:4000
ARG WIDGET_URL=http://localhost:3001
ARG API_URL=http://localhost:4000
ENV VITE_API_URL=$VITE_API_URL
ENV WIDGET_URL=$WIDGET_URL
ENV API_URL=$API_URL
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY scripts ./scripts
COPY packages ./packages
COPY apps/widget ./apps/widget
COPY apps/widget-loader ./apps/widget-loader
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
RUN pnpm exec turbo run build --filter=@solidchat/widget...
RUN pnpm --filter @solidchat/widget-loader build

FROM nginx:1.27-alpine AS runtime
COPY --from=build /repo/apps/widget/dist /usr/share/nginx/html
COPY --from=build /repo/apps/widget-loader/dist/widget.js /usr/share/nginx/html/widget.js
COPY apps/widget/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
