---
description: Add a new messaging platform behind the ChannelProvider interface
argument-hint: <platform name>
---

Add `$ARGUMENTS` as a channel type. The engine, webhooks and inbox talk only to `ChannelProvider`, so a platform is one provider plus wiring. Read `docs/architecture.md` (Provider abstraction) and `apps/api/src/modules/channels/provider/channel-provider.ts` first, and use `apps/api/src/modules/channels/instagram/` as the model.

Plan before coding, and confirm with the user anything the platform cannot do (for example no private reply to a comment, no postback buttons, no follow status).

1. **Type.** Add the value to `enum ChannelType` in `apps/api/prisma/schema.prisma` and to `ChannelType` in `packages/shared/src/enums.ts`. `pnpm db:migrate --name add_<platform>_channel`.
2. **Configuration.** App credentials in `apps/api/src/config/env.ts` (optional strings), a getter on `AppConfig` that returns null unless all are set, and entries with comments in `.env.example`.
3. **Provider.** `apps/api/src/modules/channels/<platform>/`:
   - `<platform>.provider.ts` implementing every method of `ChannelProvider` (`ChannelConnector`, `WebhookAdapter`, `Messenger`, `ContentSource`), `type`, and `isConfigured()`.
   - `verifySignature` checks the platform's signature over the raw body with a constant-time comparison (`safeEqual`).
   - `<platform>-webhook.parser.ts` turning payloads into `comment`, `message` and `postback` events. Drop the account's own echoes so replies never trigger automations. Bound every string.
   - An HTTP client that maps failures to `ProviderError` kinds: `auth`, `rate_limit`, `window_closed`, `rejected`, `transient`.
   - Where a capability does not exist, throw `ProviderError('rejected', ...)` and say so in the docs.
4. **Register** the provider in the `CHANNEL_PROVIDERS` factory in `apps/api/src/modules/channels/channels.module.ts`, and allow the type in the `channelType` parser in `channels.controller.ts`. Webhooks (`/api/v1/webhooks/:type`) and OAuth (`/api/v1/channels/oauth/:type/callback`) routes are already generic.
5. **Rate limits.** If the platform caps sends, add a budget like `engine/send-rate-limiter.ts` keyed by channel.
6. **Limits.** If message length, button count or label length differ, the shared `LIMITS` and `automationResponseSchema` need per-platform rules; discuss before changing them.
7. **Tests.** `<platform>-webhook.parser.spec.ts` with realistic payloads (including echoes and malformed input) and specs for error mapping. An integration test for the webhook route's signature check.
8. **Web.** Connect button and channel wording in `apps/web/messages/en/channels.json` and `messages/es/channels.json`, any new error codes in `errors.json` (both languages), and the platform's icon from Mola/lucide.
9. **Docs.** `docs/<platform>.md` (app setup, permissions, callback URLs, limits), and a line in `README.md` and `CHANGELOG.md`.
10. Run `/check`.
