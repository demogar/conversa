# syntax=docker/dockerfile:1
#
# Conversa API image. The same image runs three roles:
#
#   HTTP API (default):  node dist/main.js
#   Queue worker:        node dist/worker.js
#   Migrations:          node_modules/.bin/prisma migrate deploy
#
# Build from the repository root:
#
#   docker build -f docker/api.Dockerfile -t conversa-api .

ARG NODE_VERSION=22.23.3

FROM node:${NODE_VERSION}-bookworm-slim AS base
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    CI=true
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && corepack enable
WORKDIR /repo

# Download every package in the lockfile once. This layer only changes when
# the lockfile does, so source edits reuse it.
FROM base AS fetch
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN corepack install
RUN --mount=type=cache,id=conversa-pnpm-store,target=/pnpm/store \
    pnpm fetch --frozen-lockfile

FROM fetch AS build
COPY . .
RUN --mount=type=cache,id=conversa-pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --offline --filter @conversa/api...
RUN pnpm --filter @conversa/shared build \
 && pnpm --filter @conversa/api build
# A self-contained copy of the API with production dependencies only. The
# Prisma CLI is a development dependency, but the migration job needs it, so
# for this image only it is moved to the production dependencies. The
# lockfile is updated offline, which keeps every version exactly as pinned.
RUN node -e "const fs = require('node:fs'); const file = 'apps/api/package.json'; \
      const pkg = JSON.parse(fs.readFileSync(file, 'utf8')); \
      pkg.dependencies.prisma = pkg.devDependencies.prisma; delete pkg.devDependencies.prisma; \
      fs.writeFileSync(file, JSON.stringify(pkg, null, 2));" \
 && pnpm install --lockfile-only --offline
RUN --mount=type=cache,id=conversa-pnpm-store,target=/pnpm/store \
    pnpm --filter @conversa/api deploy --legacy --prod /out

FROM node:${NODE_VERSION}-bookworm-slim AS runtime
# Prisma's schema engine (used by migrations) links against OpenSSL.
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production \
    API_PORT=4000 \
    CHECKPOINT_DISABLE=1
WORKDIR /app
# The code stays owned by root; the processes run as the unprivileged node user.
COPY --from=build /out/package.json ./package.json
COPY --from=build /out/node_modules ./node_modules
COPY --from=build /repo/apps/api/dist ./dist
COPY --from=build /repo/apps/api/prisma ./prisma
COPY --from=build /repo/apps/api/prisma.config.ts ./prisma.config.ts
USER node
EXPOSE 4000
STOPSIGNAL SIGTERM
CMD ["node", "dist/main.js"]
