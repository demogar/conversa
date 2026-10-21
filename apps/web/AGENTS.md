<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Conversa web app

Project rules for `apps/web` (the repository-wide ones are in `../../AGENTS.md`):

- **UI comes only from `@demogar/mola-ui`.** Compose its components in `src/features/<area>/`; never restyle or re-implement them. Look components up with the Mola MCP server (`.mcp.json` at the root) and run its `check_code` on screens you write. Direction and voice: `../../DESIGN.md`.
- **Routes** live in `src/app/(app)/w/[workspaceId]/<area>/page.tsx`; **API hooks** in `src/lib/api/hooks/<area>.ts` using `api` from `src/lib/api/client.ts` and keys from `src/lib/api/keys.ts`.
- **Every visible word** goes through `useTranslations`, with the key in both `messages/en/<area>.json` and `messages/es/<area>.json`.
- **API errors are codes:** show them with `useErrorMessage()` and `useFieldErrors()` from `src/lib/errors.ts`. Validate forms with the shared zod schemas from `@conversa/shared`.
- **Roles:** hide controls a member cannot use; explain who can with a `Callout`.
- **States:** loading, empty, no results, error (with retry) and no permission on every list.
- The browser only calls `/api/*` on its own origin; `next.config.ts` rewrites it to the API. `src/proxy.ts` sets the nonce CSP and redirects signed-out visitors.
- Before done: `pnpm --filter @conversa/web lint`, `typecheck` and `test`.

Full guide: `../../docs/contributing/frontend-guide.md`.
