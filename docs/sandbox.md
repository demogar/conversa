# Sandbox mode

The sandbox replaces Instagram with a simulation inside Conversa. You can connect accounts, build automations, fire comments and messages at them and watch every step run, without a Meta app, a public URL or a real Instagram account. The end-to-end tests use it too.

## Turn it on

```bash
INSTAGRAM_SANDBOX=true
```

Restart the API and the worker. The channels page shows a **Sandbox mode** notice.

The sandbox **refuses to start with `NODE_ENV=production`**: the API exits with a configuration error. It cannot be switched on by accident in the Docker stack, which always runs in production mode.

While it is on, the sandbox **replaces** the real Instagram provider: no request goes to Meta, and real Instagram accounts cannot be connected at the same time.

## What it simulates

| Real Instagram | Sandbox                                                                                                                                                                                             |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OAuth connect  | **Connect Instagram account** skips the login and creates a practice account `sandbox_xxxx`. Connect as many as you like.                                                                           |
| Posts          | Six fixed posts per account, one per day going back from today, each with a caption suggesting a keyword (`LINK`, `INFO`, `CHECKLIST`, `PRICE`, `JOIN`).                                            |
| Webhooks       | **Simulate an event** on a channel builds an Instagram-shaped webhook payload and sends it through the same ingest path as a real one: stored, queued, parsed, matched and delivered by the worker. |
| Sending        | Private replies, DMs and public replies are recorded in a per-channel outbox in Valkey (the last 100) instead of being sent.                                                                        |
| Inbox          | Conversations are built from the simulated messages received and sent, so the inbox works.                                                                                                          |
| Follow status  | Everyone follows the account, **except usernames that contain `nofollow`**, which lets you test the follow gate.                                                                                    |
| Tokens         | Refreshed like real ones.                                                                                                                                                                           |

## Try it

1. Start the stack (`pnpm infra:up`, `pnpm dev`, `pnpm dev:worker`) with `INSTAGRAM_SANDBOX=true`.
2. Create your account, open **Channels**, connect a practice account.
3. Create a comment automation on **any post** with the keyword `link`, a message with a link button, and activate it.
4. On the channel, **Simulate an event** → comment on a post, from `ana`, text `Send me the LINK please`.
5. Open **Activity**: the delivery appears as sent. **Inbox** shows the message Conversa "sent".
6. Turn on the follow gate and simulate a comment from `nofollow_ben` to see the delivery wait for a follow.

## API

Every sandbox route answers `404` unless the sandbox is on. All need a session and workspace membership (any role).

| Route                                                                     | Body                                                                                                   | Does                                                                           |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| `POST /api/v1/workspaces/:workspaceId/channels/:channelId/sandbox/events` | `{ "kind": "comment", "username", "text", "mediaId?" }` or `{ "kind": "message", "username", "text" }` | Simulates a comment or a DM. Answers `202` with the stored event id.           |
| `POST /api/v1/workspaces/:workspaceId/channels/:channelId/sandbox/taps`   | `{ "deliveryId" }`                                                                                     | The contact of that delivery taps its button (opening message or follow gate). |
| `GET /api/v1/workspaces/:workspaceId/channels/:channelId/sandbox/outbox`  |                                                                                                        | What Conversa "sent" from this channel, newest first.                          |

The body is validated by `simulateEventSchema` in `@conversa/shared`.

## Code

`apps/api/src/modules/channels/sandbox/`:

| File                                          | Role                                                                                             |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `sandbox-instagram.provider.ts`               | A `ChannelProvider` that answers like Instagram. Parses webhooks with the real Instagram parser. |
| `sandbox-events.ts`                           | Builds Instagram-shaped webhook payloads.                                                        |
| `sandbox-outbox.ts`                           | The per-channel record of sent and received messages.                                            |
| `sandbox.service.ts`, `sandbox.controller.ts` | The routes above.                                                                                |
