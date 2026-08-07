# Build context MUST be the monorepo root: `docker build -f apps/dashboard/Dockerfile .`
FROM node:20-alpine AS build
RUN corepack enable
WORKDIR /repo
ARG NEXT_PUBLIC_API_URL=http://localhost:4000
ARG NEXT_PUBLIC_WIDGET_URL=http://localhost:3001
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_WIDGET_URL=$NEXT_PUBLIC_WIDGET_URL
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY packages ./packages
COPY apps/dashboard ./apps/dashboard
RUN pnpm install --frozen-lockfile
RUN pnpm exec turbo run build --filter=@solidchat/dashboard...

FROM node:20-alpine AS runtime
RUN corepack enable
WORKDIR /repo
ENV NODE_ENV=production
COPY --from=build /repo ./
WORKDIR /repo/apps/dashboard
EXPOSE 3000
CMD ["pnpm", "exec", "next", "start", "-p", "3000"]
