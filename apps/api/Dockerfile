# Build context MUST be the monorepo root: `docker build -f apps/api/Dockerfile .`
FROM node:20-alpine AS build
RUN corepack enable
WORKDIR /repo
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY packages ./packages
COPY apps/api ./apps/api
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @solidchat/database generate
RUN pnpm exec turbo run build --filter=@solidchat/api...

FROM node:20-alpine AS runtime
RUN corepack enable && apk add --no-cache curl
WORKDIR /repo
ENV NODE_ENV=production
COPY --from=build /repo ./
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -f http://localhost:4000/health/live || exit 1
CMD ["node", "apps/api/dist/main.js"]
