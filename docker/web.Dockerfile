# syntax=docker/dockerfile:1
#
# Conversa web image: the Next.js standalone server.
#
# Build from the repository root:
#
#   docker build -f docker/web.Dockerfile -t conversa-web .
#
# The /api and /l rewrites to the API are fixed when the app is built, so
# API_INTERNAL_URL is a build argument. The default matches the `api` service
# in docker/compose.yml.
#
# CONVERSA_VERSION and CONVERSA_COMMIT (the git commit) label the image, and
# the commit is built into the app beside its version (shown at /admin). The
# release workflow sets both.

ARG NODE_VERSION=22.23.3

FROM node:${NODE_VERSION}-bookworm-slim AS base
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    CI=true \
    NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /repo

# Download every package in the lockfile once. This layer only changes when
# the lockfile does, so source edits reuse it.
FROM base AS fetch
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN corepack install
RUN --mount=type=cache,id=conversa-pnpm-store,target=/pnpm/store \
    pnpm fetch --frozen-lockfile

FROM fetch AS build
ARG API_INTERNAL_URL=http://api:4000
ENV API_INTERNAL_URL=${API_INTERNAL_URL} \
    NODE_ENV=production
COPY . .
RUN --mount=type=cache,id=conversa-pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --offline --filter @conversa/web...
ARG CONVERSA_COMMIT=
ENV CONVERSA_COMMIT=${CONVERSA_COMMIT}
RUN pnpm --filter @conversa/shared build \
 && pnpm --filter @conversa/web build \
 && mkdir -p apps/web/public

FROM node:${NODE_VERSION}-bookworm-slim AS runtime
ARG CONVERSA_VERSION=dev
ARG CONVERSA_COMMIT=
LABEL org.opencontainers.image.title="conversa-web" \
      org.opencontainers.image.description="Conversa web app: self-hosted automation for Instagram comments and DMs" \
      org.opencontainers.image.version="${CONVERSA_VERSION}" \
      org.opencontainers.image.revision="${CONVERSA_COMMIT}" \
      org.opencontainers.image.source="https://github.com/demogar/conversa" \
      org.opencontainers.image.licenses="MIT"
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000
WORKDIR /app
# The code stays owned by root; the server runs as the unprivileged node user.
# Only the image cache under .next/cache needs to be writable.
COPY --from=build /repo/apps/web/.next/standalone ./
COPY --from=build /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /repo/apps/web/public ./apps/web/public
RUN mkdir -p apps/web/.next/cache && chown node:node apps/web/.next/cache
USER node
EXPOSE 3000
STOPSIGNAL SIGTERM
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/login').then((r) => process.exit(r.status < 500 ? 0 : 1), () => process.exit(1))"]
CMD ["node", "apps/web/server.js"]
