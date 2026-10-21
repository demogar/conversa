# Backend guide

How the API and worker (`apps/api`) are put together, and the rules every endpoint follows. Read [architecture.md](../architecture.md) first for the big picture.

## Stack

- NestJS 12, **ESM**. Relative imports end in **`.js`** even though the files are `.ts` (`import { X } from './x.service.js'`).
- Prisma 7 with the `pg` adapter. The client is generated into `src/generated/prisma` (git-ignored): `pnpm db:generate` after changing the schema; import types from `../../generated/prisma/client.js`.
- BullMQ for queues, ioredis for Valkey, pino for logs, zod for validation.
- Lint with oxlint (type-aware), test with Jest + SWC.

## Module layout

One folder per feature under `src/modules/<feature>/`:

```
modules/automations/
  automations.controller.ts   routes: parse input, read the guards' context, call the service
  automations.service.ts      the logic and the Prisma calls
  automations.module.ts       wiring
  *.spec.ts                   unit tests for pure logic, beside the file
```

Small read-only features keep controller, service and module in one file (`contacts/contacts.controller.ts`). Split when it grows.

Cross-cutting code lives outside `modules/`: `common/` (crypto, errors, guards, decorators, validation), `infra/` (Prisma, Redis, queues, mail, logging), `config/`.

Anything the worker needs goes in a module imported by `WorkerModule` (`src/worker.module.ts`); anything HTTP goes in `AppModule`. The worker never imports controllers.

## Configuration

Read settings only through `AppConfig` (injected). A new setting goes in `src/config/env.ts` (zod, with its default), gets a getter on `AppConfig` if it needs logic, and is documented in `.env.example` and [self-hosting.md](../self-hosting.md).

`.env` holds only what a process needs to start (database, Redis, keys, `APP_URL`, proxy, logging). Anything an operator may change while the installation runs (mail, the Meta app, Turnstile, the sign-up mode) is an instance setting: read it from `InstanceSettingsService`, whose getters are synchronous reads of an in-memory copy that every API process and worker reloads when an admin saves. Never cache a value derived from it without checking `version` (see `MailService`).

## Errors: codes, not prose

The API never returns a human sentence. Throw `AppException` with a code from `@conversa/shared`:

```ts
throw new AppException(ErrorCode.CHANNEL_NEEDS_REAUTH);
throw AppException.notFound();
```

The global filter answers `{ "error": { "code", "fields?", "requestId" } }`. Anything that is not an `AppException` becomes `INTERNAL` (500) and is logged with the request id; its message never reaches the client.

To add a code:

1. Add it to `ErrorCode` in `packages/shared/src/errors.ts`.
2. Give it an HTTP status in `STATUS` in `src/common/errors/app.exception.ts` (default 400).
3. Translate it under `codes` in `apps/web/messages/en/errors.json` **and** `messages/es/errors.json`.

## Validation with shared schemas

Request bodies are defined once, as zod schemas in `packages/shared/src/schemas/`, and used by both the web form and the API:

```ts
@Post()
create(@ZodBody(createAutomationSchema) body: CreateAutomationInput) { ... }
```

`ZodBody` / `ZodQuery` (`src/common/validation/zod.pipe.ts`) reject invalid input with `VALIDATION_FAILED` and `fields` keyed by dotted path. Custom issues use short message codes (`'required'`, `'keywords_required'`) that the web app translates; never write a sentence in a schema.

A query schema used by one endpoint only may live in its controller. Limits (lengths, counts) come from `LIMITS` in `packages/shared/src/limits.ts`.

After changing `packages/shared`, rebuild it (`pnpm --filter @conversa/shared build`; `pnpm dev` watches it).

## Guards, roles and decorators

Global guards run on every route in this order: rate limit, origin check, session, workspace membership.

| Decorator                                | Effect                                                                                                       |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `@Public()`                              | No session needed. Use sparingly.                                                                            |
| `@SkipOriginCheck()`                     | Skips the CSRF origin check. Only for server-to-server callbacks that verify their own signature (webhooks). |
| `@RequireRole('ADMIN')`                  | Minimum workspace role. Needs a `:workspaceId` route param.                                                  |
| `@RequireInstanceAdmin()`                | Only instance admins (`User.isInstanceAdmin`), checked against the database on every request.                |
| `@Throttle({ default: { limit, ttl } })` | Tighter rate limit (see the auth controller). `@SkipThrottle()` only for signed callbacks and health.        |
| `@CurrentAuth()`                         | `{ userId, sessionId }` of the signed-in person.                                                             |
| `@CurrentMembership()`                   | `{ workspaceId, role }`, set by `WorkspaceGuard`.                                                            |
| `@ClientIp()`, `@UserAgent()`            | For audit entries and sessions.                                                                              |

Roles: `MEMBER` < `ADMIN` < `OWNER` (`hasRole` in shared). Members build automations and use the inbox; admins manage channels, integrations, members and see the audit log; owners manage owners and delete the workspace.

## Tenant isolation

- Workspace routes live under `workspaces/:workspaceId/...` so `WorkspaceGuard` checks membership. A non-member gets **404**.
- **Every** Prisma query on workspace data filters by `membership.workspaceId`, including lookups by id: `findFirst({ where: { id, workspaceId } })`, never `findUnique({ where: { id } })` alone.
- Return DTOs (types in `packages/shared/src/dto.ts`), never Prisma rows. Never return encrypted columns.

## Secrets and logs

- Encrypt anything that grants access (tokens, API keys) with `CryptoService.encrypt` before storing. Store tokens sent to people (reset links, invitations) only as `hashToken()`.
- Sign anything that comes back from outside (OAuth state, button payloads, link refs) with `CryptoService.sign`/`hmac` and a `SigningPurpose`.
- Log with Nest's `Logger`, object first: `this.logger.warn({ err, channelId }, 'Token refresh failed')`. Never log tokens, keys, message text or full URLs with query strings. Add new sensitive field names to `REDACT` in `src/infra/infra.module.ts`.

## Audit

Administrative and security-relevant actions call `AuditService.record({ action, actorId, workspaceId, targetType, targetId, metadata })`. Add the action name (`area.verb_object`) to `AuditAction` and its sentence under `audit.actions` in `messages/en/settings.json` and `messages/es/settings.json` so the audit log can show it.

## Talking to a platform

Never call a platform's HTTP API from a feature module. Go through `ProviderRegistry` and the `ChannelProvider` interface, and through `ChannelsService.callProvider()` where a failure should mark the channel as needing reconnection. See [architecture.md](../architecture.md#provider-abstraction).

## Adding an endpoint

Example: `GET /api/v1/workspaces/:workspaceId/automations/:automationId/stats`.

1. **Contract.** If it takes input, add a zod schema in `packages/shared/src/schemas/`. Add the response type to `packages/shared/src/dto.ts`. Export both from `index.ts`.
2. **Service.** Add the method to `AutomationsService`. Scope by `workspaceId`; throw `AppException.notFound()` when the row is not in the workspace.
3. **Controller.** Add the route with `@CurrentMembership()`, `@ZodBody`/`@ZodQuery`, and `@RequireRole` if members may not use it.
4. **Audit** if it changes something an admin would want to trace.
5. **Errors.** New failure modes get a new `ErrorCode` (see above).
6. **Tests.** A unit spec for pure logic; an integration test for the route, its roles, and cross-workspace access.
7. **Web.** A hook in `apps/web/src/lib/api/hooks/<area>.ts`, words in `messages/en` and `messages/es`.
8. Run `pnpm check`.

## Database migrations

1. Edit `prisma/schema.prisma`. Keep the comments: they document intent.
2. `pnpm db:migrate --name <what_changed>` creates the migration and regenerates the client.
3. Commit the migration folder. Never edit a migration that has been released; add a new one.

### Backward compatible with the previous release

Upgrades are zero-downtime rolling updates: the `migrate` job runs first, then `api`, `worker` and `web` are replaced one at a time while the previous version keeps serving. So for a while the **previous release runs against the new schema**, and every migration must keep it working. Use expand/contract:

1. **Expand.** Add new tables, and new columns as nullable or with a default. Nothing the previous release reads or writes changes.
2. **Write both.** Ship code that writes the old and the new shape and reads the new one, falling back to the old.
3. **Backfill.** Fill the new shape for existing rows.
4. **Contract, in a later release.** Only once no running version uses the old shape: drop or rename the old column, or make the new one `NOT NULL`.

Checklist for every migration:

- [ ] Adds only: new tables, nullable columns or columns with a default, new indexes.
- [ ] Does not drop or rename a table or column in the same release that stops using it.
- [ ] Does not make a column `NOT NULL` that the previous release may leave empty.
- [ ] Enums: adds values only. Never removes or renames one; the previous release may still write it.
- [ ] Long-running data changes (backfills over many rows) are idempotent jobs, not part of the schema migration, so the `migrate` step stays fast and can be rerun.

Example: renaming `Automation.title` to `Automation.name`.

- **Release N:** migration adds `name` (nullable). Code writes `title` and `name`, reads `name ?? title`. A job copies `title` into `name` where `name` is null.
- **Release N+1:** code stops using `title`. No schema change for `title` yet, because release N is still running during the rollout.
- **Release N+2:** migration drops `title` and, if needed, makes `name` `NOT NULL`.

### Queues and caches across versions

During a rollout an API and a worker of two adjacent versions can run at the same time. Queue job payloads and Valkey (Redis) keys must stay compatible across one version:

- A new worker must process jobs enqueued by the previous API, and the previous worker must tolerate jobs from the new API. Add payload fields as optional; do not rename or remove a field in the same release that stops sending it.
- Do not change the format of an existing key. Use a new key name, and stop using the old one in a later release.
