# Buffer integration

Schedule a post in Buffer, attach an automation to it in Conversa, and the automation starts answering comments the moment Buffer publishes the post. No copying post links after the fact.

## What Conversa does with Buffer

- **Read only.** Conversa reads organizations, channels and posts through Buffer's GraphQL API. It never creates, edits or deletes anything in Buffer.
- **One connection per workspace**, made with a personal API key.
- The key is validated against Buffer before it is saved, then stored **encrypted** (AES-256-GCM). It is never sent to the browser and never cached.

## Connect

1. In Buffer, create a **personal API key** in your account's API settings.
2. In Conversa, an owner or admin opens **Settings → Integrations → Buffer** and pastes the key.
3. If the key can see several Buffer organizations, choose the one whose posts Conversa should read.

Scheduled and recently sent posts then show on the **Content** page.

Buffer's Instagram channels are matched to Conversa's channels by **handle**: the Buffer channel `@mybrand` belongs to the connected Instagram account `mybrand`. Posts for Buffer channels with no matching Conversa channel are not offered.

Disconnecting deletes the stored key. Automations already waiting on a Buffer post stay, but will not start until Buffer is connected again.

## Attach an automation to a scheduled post

1. Create a comment automation and pick the post scope **A post scheduled in Buffer**.
2. Choose the scheduled post.
3. Activate the automation. It waits.

When Buffer publishes the post:

1. The worker's `resolve-scopes` job (every 5 minutes) asks Buffer for each waiting post.
2. Once Buffer reports it as sent, Conversa takes the Instagram URL Buffer returns, finds the media with the same shortcode among the account's latest posts, and binds the automation to it.
3. From then on the automation behaves like one bound to that specific post.

Comments that arrive in the first minutes, before the bind, are not answered. If that matters for a launch, the **next post** scope binds as soon as the first comment on a new post arrives.

## Rate limits and caching

Buffer allows about **100 requests per 15 minutes** per key.

- Reads for the UI (organizations, channels, scheduled and sent posts) are cached in Valkey for **2 minutes** per workspace. Only the results are cached, never the key. Connecting, changing organization or disconnecting clears the cache.
- The background job checks at most 50 waiting automations per run, and stops the run as soon as Buffer answers with a rate limit.
- The last problem (`unauthorized`, `rate_limited`, `not_found`, `unavailable`) is shown on the integration page. A revoked key shows as `unauthorized`: connect again with a new one.
