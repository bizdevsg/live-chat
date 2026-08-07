# Build context MUST be the monorepo root: `docker build -f apps/widget/Dockerfile .`
# Produces a single static nginx image serving both the widget iframe app (chat SPA) and
# widget.js (the loader) from the same origin, matching §42's "chat.sg-berjangka.com" host.
FROM node:20-alpine AS build
RUN corepack enable
WORKDIR /repo
ARG VITE_API_URL=http://localhost:4000
ARG WIDGET_URL=http://localhost:3001
ARG API_URL=http://localhost:4000
ENV VITE_API_URL=$VITE_API_URL
ENV WIDGET_URL=$WIDGET_URL
ENV API_URL=$API_URL
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY packages ./packages
COPY apps/widget ./apps/widget
COPY apps/widget-loader ./apps/widget-loader
RUN pnpm install --frozen-lockfile
RUN pnpm exec turbo run build --filter=@solidchat/widget...
RUN pnpm --filter @solidchat/widget-loader build

FROM nginx:1.27-alpine AS runtime
COPY --from=build /repo/apps/widget/dist /usr/share/nginx/html
COPY --from=build /repo/apps/widget-loader/dist/widget.js /usr/share/nginx/html/widget.js
COPY apps/widget/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
