ARG NODE_VERSION=24
ARG ALPINE_VERSION=3.21
ARG PNPM_VERSION=10.33.4

FROM node:${NODE_VERSION}-alpine${ALPINE_VERSION} AS base

ENV APP_PATH=/home/node/app
WORKDIR $APP_PATH

RUN apk add --no-cache tini \
 && corepack enable \
 && chown node:node $APP_PATH

USER node

ARG PNPM_VERSION
RUN corepack prepare pnpm@${PNPM_VERSION} --activate


FROM base AS builder

# Default placeholder for Prisma schema validation (overridable via --build-arg)
ARG DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"
ENV DATABASE_URL=${DATABASE_URL}

COPY --chown=node:node package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json tsconfig.prod.json prisma.config.ts ./
RUN pnpm install --frozen-lockfile

COPY --chown=node:node src/ ./src/
COPY --chown=node:node prisma/ ./prisma/
RUN pnpm exec prisma generate
RUN pnpm run build:prod


FROM base AS development


FROM base AS production

ENV NODE_ENV=production

COPY --chown=node:node package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --prod

COPY --from=builder --chown=node:node $APP_PATH/dist ./dist
COPY --from=builder --chown=node:node $APP_PATH/prisma ./dist/prisma
COPY --from=builder --chown=node:node $APP_PATH/prisma.config.ts ./dist/prisma.config.ts

COPY --chown=node:node --chmod=755 entrypoint.prod.sh ./

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["./entrypoint.prod.sh"]
