# Conversa

Open-source (MIT), self-hosted automation for Instagram comments and DMs: comment-to-DM with keywords, DM and story-reply triggers, follow gates, tracked link buttons, Buffer-scheduled posts. Built to add other platforms behind one provider interface. **The repository is public.**

## Commands

```bash
pnpm install
pnpm infra:up                 # PostgreSQL, Valkey, Mailpit (docker/compose.dev.yml)
pnpm db:migrate               # prisma migrate dev (regenerates the client)
pnpm dev                      # shared (watch) + API :4000 + web :3000
pnpm dev:worker               # queue worker (or WORKER_IN_API=true)
pnpm check                    # format:check + lint + typecheck + unit tests  <- the gate
pnpm test                     # unit tests, all packages
pnpm --filter @conversa/api test:integration   # needs infra:up
pnpm test:e2e                 # Playwright, sandbox mode
pnpm --filter @conversa/shared build           # after changing packages/shared
```

`INSTAGRAM_SANDBOX=true` in `.env` replaces Instagram with a simulation (never in production).

## Map

| Path                                                         | What                                                                                                           |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| `apps/api/src/main.ts`, `worker.ts`                          | API (HTTP, `/api/v1`) and worker (queues) entry points; same codebase                                          |
| `apps/api/src/config/env.ts`                                 | Bootstrap settings, validated with zod. Read via `AppConfig` only                                              |
| `apps/api/src/modules/instance/instance-settings.service.ts` | Mail, Meta app, Turnstile, sign-up mode: edited at `/admin`, encrypted in the DB, never in env                 |
| `apps/api/prisma/schema.prisma`                              | Data model; every team row has `workspaceId`                                                                   |
| `apps/api/src/modules/channels/provider/channel-provider.ts` | The platform contract. Instagram in `instagram/`, simulation in `sandbox/`                                     |
| `apps/api/src/modules/webhooks/`                             | Verify signature, store `InboundEvent`, enqueue. Nothing else                                                  |
| `apps/api/src/modules/engine/`                               | Worker: selector (one automation per event), `delivery.service.ts` state machine, rate limiter, scope resolver |
| `apps/api/src/common/`                                       | Crypto, `AppException`, guards (origin, throttle), decorators, `ZodBody`                                       |
| `apps/web/src/app/(app)/w/[workspaceId]/`                    | Routes; screens in `src/features/<area>/`; hooks in `src/lib/api/hooks/`                                       |
| `apps/web/messages/{en,es}/`                                 | Translations, one JSON per area                                                                                |
| `packages/shared/src/`                                       | zod schemas, DTOs, `ErrorCode`, `LIMITS`, keyword matching                                                     |
| `docs/`                                                      | architecture, self-hosting, instagram, cloudflare, buffer, sandbox, testing, i18n, contributing guides         |

## Conventions

- **API is ESM: relative imports end in `.js`.** Prisma types from `../../generated/prisma/client.js`.
- **Errors are codes, not prose.** `throw new AppException(ErrorCode.X)`. New code: add to `packages/shared/src/errors.ts`, status in `common/errors/app.exception.ts`, text under `codes` in `messages/en/errors.json` and `messages/es/errors.json`.
- **Validation uses shared zod schemas** (`packages/shared/src/schemas/`) with `@ZodBody`/`@ZodQuery`; the web form uses the same schema. Issue messages are short codes.
- **Tenant isolation:** workspace routes are `workspaces/:workspaceId/...`; every query filters by `membership.workspaceId`. Roles via `@RequireRole('ADMIN')`. Non-members get 404.
- **Platforms only through `ProviderRegistry`/`ChannelProvider`**; failures as `ProviderError` kinds.
- **Encrypt** tokens and keys with `CryptoService`; store tokens sent to people as hashes; sign anything that comes back from outside.
- **UI: Mola UI only** (`@demogar/mola-ui`). No other component library, no hand-made buttons/inputs/dialogs, no radius, no borders on controls, tokens only, logical properties, every state (loading, empty, no results, error, no permission). See `DESIGN.md` and `docs/contributing/frontend-guide.md`.
- **Every visible word in both `en` and `es`**, same keys. Spanish is Latin American, `tú`, natural.
- **Migrations are backward compatible with the previous release** (upgrades are rolling: old and new code run together). Expand/contract: add nullable columns and tables first, drop, rename or set `NOT NULL` only in a later release; enums add values only; big backfills are idempotent jobs. Queue payloads and Valkey keys stay compatible across one version. See `docs/contributing/backend-guide.md#database-migrations`.
- Comments explain why. Match the surrounding code's density and naming.

## Commits and releases

Conventional Commits (`feat(engine): ...`, `fix(web): ...`). PRs are squash-merged, so the **PR title** is the commit on `main` and must be a Conventional Commit (checked by `.github/workflows/pr-title.yml`). release-please builds `CHANGELOG.md` and the version from those titles and opens a release PR; merging it tags `vX.Y.Z` and publishes the GHCR images. Never edit `CHANGELOG.md` or the `version` fields by hand. Pin any new GitHub Action to a full commit SHA with a `# vX.Y.Z` comment. Details: `CONTRIBUTING.md#releases`.

## Mola MCP server

`.mcp.json` registers `mola-ui` (`list_components`, `get_component`, `search`, `get_tokens`, `get_rules`, `get_pattern`, `check_code`). Look a component up before using it, and run `check_code` on screens you write.

## Never

- Commit secrets, `.env`, real hostnames, IPs, emails or personal data. Use `example.com`.
- Read `.env` files (only `.env.example`).
- Mention other projects as sources or inspiration.
- Call a platform API from a feature module, or return Prisma rows or encrypted columns to clients.
- Edit a released migration; add a new one.

## Before saying done

Run `pnpm check`. If you touched API routes, guards or the engine, also `pnpm --filter @conversa/api test:integration`. If you touched a screen, its `*.test.tsx` and `pnpm --filter @conversa/web lint`. Report failures as they are.
