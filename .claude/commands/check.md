---
description: Run Conversa's full quality gate and report the real results
---

Run the gate for this repository and report what passed and what failed. Do not claim success without the output.

1. `pnpm --filter @conversa/shared build` (the apps import the built package).
2. `pnpm check` — Prettier check, lint (oxlint for the API, ESLint with Mola's design rules for the web app), typecheck, and every unit suite.
3. If the change touches `apps/api/src/modules/**` routes, guards, the engine, webhooks or Prisma: `pnpm --filter @conversa/api test:integration` (needs `pnpm infra:up`; if the services are not reachable, say so instead of skipping silently).
4. If `$ARGUMENTS` contains `e2e`, also run `pnpm test:e2e`.

When something fails:

- Show the failing command and the relevant lines of its output.
- Fix formatting with `pnpm format` only if the user asked for fixes; otherwise list the files.
- For a failing test, say whether the test or the code looks wrong, with the file and line.

Finish with a short table: step, result (pass / fail / not run), and why for anything not run.
