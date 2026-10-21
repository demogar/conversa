# Agent guide

Instructions for AI coding agents working in this repository. `CLAUDE.md` holds the same guidance; keep the two in step.

## Project

Conversa: open-source (MIT), self-hosted automation for Instagram comments and DMs, designed to support more platforms through one provider interface. pnpm monorepo:

- `apps/api`: NestJS 12 (ESM) API and queue worker, Prisma 7 + PostgreSQL, BullMQ + Valkey.
- `apps/web`: Next.js 16 App Router, next-intl (en, es), TanStack Query, UI from Mola UI only. See `apps/web/AGENTS.md`.
- `packages/shared`: zod schemas, DTOs, error codes, limits, keyword matching, used by both apps.

The repository is **public**.

## Setup and commands

```bash
pnpm install
cp .env.example .env && pnpm secrets:generate   # paste output into .env; set INSTAGRAM_SANDBOX=true for no Meta app
pnpm infra:up && pnpm db:migrate
pnpm dev && pnpm dev:worker
```

| Task                            | Command                                                                |
| ------------------------------- | ---------------------------------------------------------------------- |
| Full gate                       | `pnpm check` (prettier, lint, typecheck, unit tests)                   |
| Unit tests                      | `pnpm test` or `pnpm --filter <package> test`                          |
| API integration tests           | `pnpm --filter @conversa/api test:integration` (needs `pnpm infra:up`) |
| End-to-end                      | `pnpm test:e2e`                                                        |
| After editing `packages/shared` | `pnpm --filter @conversa/shared build`                                 |
| After editing the Prisma schema | `pnpm db:migrate --name <change>`                                      |

## Rules

1. Relative imports in `apps/api` end in `.js`.
2. The API returns error **codes** (`AppException(ErrorCode.X)`), never sentences. A new code is added in `packages/shared/src/errors.ts`, mapped to a status in `apps/api/src/common/errors/app.exception.ts`, and translated under `codes` in `apps/web/messages/en/errors.json` and `messages/es/errors.json`.
3. Request validation uses the shared zod schemas through `@ZodBody` / `@ZodQuery`.
4. Workspace data is always queried with `workspaceId`; roles use `@RequireRole`.
5. Platform calls go through `ProviderRegistry` and the `ChannelProvider` interface (`apps/api/src/modules/channels/provider/channel-provider.ts`).
6. UI uses only `@demogar/mola-ui` components and tokens. Use the Mola MCP server from `.mcp.json` (`get_component`, `get_pattern`, `check_code`). Design direction: `DESIGN.md`.
7. Every visible string exists in both `messages/en` and `messages/es`, with the same keys.
8. Never commit or print secrets, `.env` contents, real hostnames, IPs, emails or personal data. Do not read `.env`.
9. Do not mention other projects as sources or inspiration.
10. Run `pnpm check` before declaring work done and report the real result.

## Where to read more

`docs/architecture.md`, `docs/contributing/backend-guide.md`, `docs/contributing/frontend-guide.md`, `docs/testing.md`, `docs/i18n.md`, `SECURITY.md`.
