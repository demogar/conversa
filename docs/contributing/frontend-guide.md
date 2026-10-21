# Frontend guide

How the web app (`apps/web`) is put together, and the rules every screen follows.

## Stack

- Next.js 16 App Router (`src/app`). Pages are client components that fetch through TanStack Query; layouts may be server components.
- UI comes **only** from [`@demogar/mola-ui`](https://demogar.github.io/molaui/). Do not write generic UI components (buttons, inputs, cards, tables, dialogs…). Feature components in `src/features/<area>/` *compose* Mola components; they never restyle or re-implement them.
- Tailwind v4 with Mola's layer (`@demogar/mola-ui/tailwind.css`): layout utilities (`grid`, `gap-4`, `p-6`) and Mola's token utilities (`text-ink-muted`, `bg-cloth`, `shadow-cut`). The ESLint plugin `@demogar/mola-ui/eslint` enforces the design rules.
- `next-intl` without locale routing: the locale comes from the `conversa_locale` cookie, then the browser. English and Spanish.

## Where things go

| What | Where |
| --- | --- |
| A route | `src/app/(app)/w/[workspaceId]/<area>/page.tsx` (inside the app shell) |
| Screens and pieces of one area | `src/features/<area>/` |
| API calls and query hooks of one area | `src/lib/api/hooks/<area>.ts` (use `api` from `src/lib/api/client.ts` and keys from `src/lib/api/keys.ts`) |
| Words | `messages/en/<namespace>.json` and `messages/es/<namespace>.json` — always both, same keys |
| Tests | beside the file, `*.test.tsx` (Jest + React Testing Library) |

## Rules

1. **Every visible word is translated.** `useTranslations('<namespace>')`. Write natural Spanish (Latin American, `tú`), not a literal translation. Message keys are typed: a missing key fails `tsc`.
2. **API errors are codes.** Show them with `useErrorMessage()`; map field errors with `useFieldErrors()` (`src/lib/errors.ts`). Validate forms with the shared zod schemas from `@conversa/shared` before sending.
3. **Respect roles.** `useCurrentWorkspace(workspaceId)?.role` is `OWNER`, `ADMIN` or `MEMBER`. Members never see controls they cannot use; show values as text and a `Callout` naming who can change them (Mola's "no permission" pattern).
4. **Every list has its states:** loading (`Skeleton`/`SkeletonGroup` or table loading rows), empty (`EmptyState kind="empty"`), no results (`kind="no-results"`), error (`kind="error"` with Retry), no permission.
5. **Mola's design rules:** no radius, no `border` on controls, tokens only, logical properties (`ps-`/`pe-`, `ms-`/`me-`), sentence-case labels, buttons start with a verb and name the object, state is never colour alone (badge word + tone + dot).
6. **Links** use Next's `Link` through Mola's `render` prop: `<NavItem render={<NextLink href=… />}>`, `<LinkButton render={<NextLink href=… />}>`.
7. **Destructive actions** go through `AlertDialog`; results that happen elsewhere go through `useToast()`.
8. **Dates** use Mola's `RelativeTime` or `Intl` with the active locale.
9. Pages get a `PageHeader` (one `h1`), then content padded with `p-4 sm:p-6`.

## Reference

- Component API: `node_modules/@demogar/mola-ui/docs/ai/components.json` or https://demogar.github.io/molaui/llms-components.txt
- Whole-screen examples to copy from: the Mola patterns (settings page, filtered table, list and detail, confirmation, empty states).
