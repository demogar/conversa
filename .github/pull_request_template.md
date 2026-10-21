## Summary

<!-- What does this change and why? Link related issues: "Closes #123". -->

## How it was tested

<!-- Commands you ran, and manual checks with steps. -->

## Checklist

- [ ] Tests added or updated (unit, integration or e2e as fits), and `pnpm check` passes
- [ ] Every new user-facing string is translated in both English (`en`) and Spanish (`es`)
- [ ] UI uses Mola UI components and tokens only, no ad hoc styling or other component libraries
- [ ] No secrets, tokens, real hostnames, IP addresses or personal data in code, fixtures, logs or screenshots
- [ ] Database changes come with a Prisma migration
- [ ] Migrations are backward compatible (expand/contract), and queue payloads and cache keys still work with the previous release
- [ ] New configuration is documented in `.env.example`
