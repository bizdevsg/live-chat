# Build context MUST be the monorepo root: `docker build -f apps/worker/Dockerfile .`
FROM node:20-alpine AS build
RUN corepack enable
WORKDIR /repo
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY packages ./packages
COPY apps/worker ./apps/worker
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @solidchat/database generate
RUN pnpm exec turbo run build --filter=@solidchat/worker...

FROM node:20-alpine AS runtime
RUN corepack enable
WORKDIR /repo
ENV NODE_ENV=production
COPY --from=build /repo ./
CMD ["node", "apps/worker/dist/main.js"]
