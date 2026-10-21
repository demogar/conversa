# Testing

| Suite           | Where                                         | Runner                               | Needs                            |
| --------------- | --------------------------------------------- | ------------------------------------ | -------------------------------- |
| Shared unit     | `packages/shared/src/**/*.test.ts`            | Jest + SWC                           | nothing                          |
| API unit        | `apps/api/src/**/*.spec.ts`, beside the code  | Jest + SWC                           | nothing                          |
| API integration | `apps/api/test/integration/**/*.int-spec.ts`  | Jest, in band                        | PostgreSQL and Valkey            |
| Web unit        | `apps/web/src/**/*.test.tsx`, beside the code | Jest + React Testing Library (jsdom) | nothing                          |
| End to end      | `e2e/`                                        | Playwright                           | the whole stack, in sandbox mode |

## Commands

```bash
pnpm test                                   # every unit suite (shared, api, web)
pnpm --filter @conversa/shared test
pnpm --filter @conversa/api test
pnpm --filter @conversa/web test
pnpm --filter @conversa/api test:integration
pnpm test:e2e
pnpm check                                  # format, lint, typecheck, unit tests: the gate before a PR
```

Run one file or one test name with Jest's own arguments:

```bash
pnpm --filter @conversa/api test automation-selector
pnpm --filter @conversa/web test -t "shows the empty state"
```

The API and shared packages are ESM; their Jest scripts set `--experimental-vm-modules` already, so always run them through `pnpm`.

## Integration tests

They boot the real Nest application (`test/integration/support/app.ts`) against a test database and Valkey, with the simulated Instagram in place of the real one. Start the development services first:

```bash
pnpm infra:up
pnpm --filter @conversa/api test:integration
```

The global setup (`test/integration/support/global-setup.ts`) takes the servers from `DATABASE_URL` and `REDIS_URL` (the environment, or the repository's `.env`) and uses its own space on them: the database `conversa_test`, created if missing and migrated with `prisma migrate deploy`, and Valkey logical database `15`, emptied before each run. It sets fresh secrets and `NODE_ENV=test`; the instance settings start empty on the fresh database, so there is no mail, no captcha and sign-up is by invitation. Your development data is never touched.

Suites: `auth`, `workspaces`, `automations`, `webhooks`, `engine` (`*.int-spec.ts`).

## End-to-end tests

Playwright (`e2e/`) starts an isolated stack of its own — API on port `4100`, worker, web on `3100` — with `INSTAGRAM_SANDBOX=true`, against the database `conversa_e2e` and Valkey database `14` on the same servers as `DATABASE_URL` and `REDIS_URL`. `e2e/scripts/prepare.mjs` builds the apps, recreates that database and applies the migrations before the API starts.

```bash
pnpm infra:up
pnpm --filter @conversa/e2e install:browsers   # once: downloads Chromium
pnpm test:e2e
E2E_SKIP_BUILD=1 pnpm test:e2e                 # reuse the last build
pnpm --filter @conversa/e2e test:ui            # Playwright's UI mode
pnpm --filter @conversa/e2e report             # open the last HTML report
```

The `onboarding` spec runs first and creates the owner account the other specs sign in with. Specs: `onboarding`, `channel-and-automation` (connect a practice account, build an automation, simulate a comment, see the delivery), `team`, `i18n`, `security`. Ports and names can be changed with `E2E_API_PORT`, `E2E_WEB_PORT`, `E2E_DATABASE_NAME` and `E2E_REDIS_DB`.

## What to test

- **Shared**: schemas (valid and invalid inputs), keyword matching edge cases, templating.
- **API unit**: pure logic with no I/O — parsers, selectors, signing, permalink handling. Providers' webhook parsers always have a spec with real payload shapes.
- **API integration**: guards and roles (a member of another workspace gets `404`), validation errors, the webhook → worker → delivery pipeline, idempotency on redelivered webhooks.
- **Web**: each screen's states (loading, empty, no results, error, no permission) and its main interaction. Render with `src/test/render.tsx`, which wraps the providers and messages.

Prefer a few tests that exercise behaviour over many that pin implementation details.

## Continuous integration

`.github/workflows/ci.yml` runs on every pull request and on pushes to `main`:

| Job                            | Runs                                                                                                    |
| ------------------------------ | ------------------------------------------------------------------------------------------------------- |
| Lint, typecheck and unit tests | `pnpm -r lint`, `pnpm -r typecheck`, unit tests of every package                                        |
| Integration tests              | The API integration suite against PostgreSQL 17 and Valkey 9 service containers, with throwaway secrets |
| Build images                   | Both Dockerfiles                                                                                        |
| End-to-end tests               | `pnpm build`, then `pnpm test:e2e`; the Playwright report is uploaded as an artifact                    |

Also: CodeQL (`codeql.yml`), a Gitleaks secret scan (`secret-scan.yml`), and Dependabot. CI does not run `pnpm format:check`; run `pnpm check` locally before pushing.
