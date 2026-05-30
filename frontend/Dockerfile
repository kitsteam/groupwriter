ARG NODE_VERSION=24
ARG ALPINE_VERSION=3.21
ARG PNPM_VERSION=10.33.4

# Base:
FROM node:${NODE_VERSION}-alpine${ALPINE_VERSION} AS base

ENV APP_PATH=/home/node/app
WORKDIR $APP_PATH

RUN apk add --no-cache bash git \
 && corepack enable \
 && chown node:node $APP_PATH

USER node

ARG PNPM_VERSION
RUN corepack prepare pnpm@${PNPM_VERSION} --activate

# Workspace manifests + the local packages (their sources run a `prepare` build on install).
COPY --chown=node:node package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./
COPY --chown=node:node packages ./packages

# Development:
FROM base AS development
RUN pnpm install --frozen-lockfile

# Production builder:
FROM base AS production_builder
ARG VITE_HOCUSPOCUS_SERVER_URL
ARG VITE_HOCUSPOCUS_SUBDOMAIN
ARG VITE_LEGAL_URL
ARG VITE_PRIVACY_STATEMENT_URL

RUN pnpm install --frozen-lockfile

COPY --chown=node:node src ./src
COPY --chown=node:node public ./public
COPY --chown=node:node config ./config
COPY --chown=node:node postcss.config.mjs vite.config.ts index.html ./

RUN pnpm run build

# Production:
FROM nginxinc/nginx-unprivileged:stable-alpine-slim AS production

COPY --from=production_builder --chown=nginx:nginx /home/node/app/dist /usr/share/nginx/html
COPY --from=production_builder --chown=nginx:nginx /home/node/app/config/nginx/default.conf /etc/nginx/conf.d/default.conf
