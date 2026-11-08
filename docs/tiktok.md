# Connecting TikTok

Conversa talks to TikTok through TikTok's API for Business (the Accounts and Business Messaging APIs). On TikTok, Conversa **answers direct messages only**: keyword triggers, the opening message, the follow gate and tracked links all work in DMs, but comments cannot start automations. This page explains why, sets up the developer app, and lists what differs from Instagram.

Each installation needs its own TikTok developer app. The app ID, secret and authorization URL are entered in the admin area (**Instance settings → TikTok app**) and stored encrypted, never in `.env`.

## What TikTok allows

Read this before you start: some of it depends on where the account is registered.

|                                            | Instagram                             | TikTok                                                                                                                                                                      |
| ------------------------------------------ | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Comment triggers                           | Yes, answered with a private reply    | **No.** TikTok cannot message the author of a comment (its "Comment-to-Message" is limited to accounts in Vietnam, Indonesia and Thailand, on comments TikTok picks itself) |
| Message triggers                           | Yes                                   | Yes                                                                                                                                                                         |
| Who can be messaged                        | People who wrote in the last 24 hours | Only people who wrote first. Up to 10 messages in the 48 hours after their first message, then unlimited for 48 hours after each reply, then 3 more until they write again  |
| Link buttons                               | Up to 3                               | **None.** Each link is written under the message as `Label: https://…`, still tracked                                                                                       |
| Tap buttons (opening message, follow gate) | Postback buttons                      | Q&A card "reply" buttons (title up to 40 characters, button up to 20)                                                                                                       |
| Follow status                              | Looked up when the person taps        | Sent by TikTok with every message the person sends                                                                                                                          |
| Access tokens                              | 60 days, refreshed                    | 1 day, refreshed every 6 hours with a refresh token valid for a year                                                                                                        |

Business Messaging also has access rules of its own:

- TikTok must approve your app for it, after a data security and privacy review (an intake form; processing starts within 10 working days). Accounts registered in the **United States** need TikTok's additional US data security review.
- It is **not available** for accounts registered in the **EEA, the United Kingdom or Switzerland**. Those accounts can be connected, but TikTok sends no messages for them.
- The account must be a TikTok account with Advanced Access or a Verified Business Account, owned by someone 18 or older.

## Before you start

- Conversa must be reachable over **HTTPS** at its `APP_URL`; TikTok only calls HTTPS URLs.
- You need a TikTok For Business developer account at the [TikTok API for Business portal](https://business-api.tiktok.com/portal).

**Upgrading?** Finish rolling out the release that adds TikTok to every API process and worker before you set up the TikTok app. A worker from the previous release does not know TikTok, and fails the TikTok events it picks up.

## 1. Start the app

In the portal, open **My Apps** and start an app, without submitting it yet:

- **App logo:** JPG or PNG, at most 512 × 512 px. Without one, people see an error page when they connect.
- **Scope of permission:** select **TikTok Accounts**. Business Messaging is not offered here; see step 4.
- **TikTok account holder redirect URL:** the address shown in **Instance settings → TikTok app**:

```
https://conversa.example.com/api/v1/channels/oauth/tiktok/callback/
```

It **must end in a slash** and match exactly. With several redirect URLs, make this one active.

## 2. Send the Accounts API form

Send the **Accounts API Access Application Form**, linked next to TikTok Accounts, then submit the app. Send the form once. It asks for business documents and a screen recording. The App ID appears after TikTok approves the app.

## 3. Copy the app into Conversa

From **Basic Information**, copy into **Instance settings → TikTok app**:

- App ID
- Secret
- TikTok account holder authorization URL, as it is

**Connection to TikTok** then says whether TikTok accepts the app ID and secret. It is a good sign, not a guarantee: Conversa exchanges a code that cannot work and reads TikTok's complaint.

## 4. Request Business Messaging

1. Send the intake form from [TikTok's guide](https://business-api.tiktok.com/portal/docs/access-to-business-messaging-api/v1.3) with your App ID and the regions where your accounts signed up. Send it once.
2. Answer the questionnaire TikTok emails to your contact. US accounts get a second one about a week later and, after passing, the USDS Addendum.
3. Once approved, paste the new authorization URL and reconnect your accounts.

To add the US after another region is approved, send the form again with its option for extending access.

## 5. Webhook

TikTok has one webhook per app, not per account, and no verification handshake. Conversa registers it for you (`POST /business/webhook/update/` with event type `DIRECT_MESSAGE`) each time an account connects, at:

```
https://conversa.example.com/api/v1/webhooks/tiktok
```

Every delivery is checked against the `Tiktok-Signature` header: `t=<unix seconds>,s=<hex>`, where `s` is the HMAC-SHA256 of `<t>.<raw body>` keyed with the app secret. Deliveries older than five minutes or with a wrong signature are refused with `401` and never stored. TikTok retries a failed delivery for 72 hours; Conversa answers each message once however often it arrives.

## 6. Connect the account

In a workspace, open **Channels** and choose **Connect TikTok account**. Sign in to TikTok as the business account and approve the permissions. You come back to the channels page with the account listed as **TikTok**.

Then create an automation on it with the **Direct message** trigger. The comment trigger is unavailable for TikTok channels, in the editor and in the API (`VALIDATION_FAILED`, `triggerType: not_supported_by_channel`).

## How it works

| Piece                         | Where                                                          |
| ----------------------------- | -------------------------------------------------------------- |
| Provider                      | `apps/api/src/modules/channels/tiktok/tiktok.provider.ts`      |
| HTTP client and error mapping | `tiktok-api.client.ts`                                         |
| Webhook parser                | `tiktok-webhook.parser.ts`                                     |
| What each platform can do     | `packages/shared/src/capabilities.ts` (`CHANNEL_CAPABILITIES`) |

- **Contacts are conversations.** TikTok sends replies to a conversation, not to a person, so a TikTok contact's id is its `conversation_id`. The username and the follow status come with each `im_receive_msg` event and are stored on the contact.
- **Echoes are dropped.** Messages the account sends (`im_send_msg`, or any message from the `business_account` side or sent through the API) never start automations.
- **Two-part messages.** A long gate message goes out as a text and a card. Each step of a delivery passes the engine's idempotency key, and the provider remembers the parts already sent (in Valkey, for a day), so a retry after a failed card sends only the card.
- **Taps.** The opening message and the follow gate become a Q&A button card whose button id carries a signed token (`c1.<delivery>.<signature>`, 40 characters at most). A message longer than a card title goes first as text, followed by a card titled with its button. When the person taps, TikTok sends the button text as a message with `reply_source_payload`, which Conversa reads as the tap.
- **Errors.** TikTok answers HTTP 200 for most failures; the `code` decides. Token codes (40102–40107, 40131) mark the channel for reconnecting, 40100 and 40016 are rate limits (retried), 40064 (blocked by the direct message rules) is a closed messaging window, 5xxxx codes are retried, anything else is rejected.
- **Large ids.** Some TikTok ids are numbers above 2^53. Responses are parsed so that such numbers are kept as exact strings.

## Rate limits

TikTok allows about 40 requests per minute per account per endpoint, and 600 to 1,000 per minute per account across the Accounts API. Conversa sends one or two requests per message, so ordinary traffic stays far below this; a throttled send (code 40100) is retried later.

## Troubleshooting

- **The account connected, but no messages arrive.** An account can connect before Business Messaging is approved. Has TikTok approved it for this account's region, and did you reconnect afterwards? Is the account registered in the EEA, the UK or Switzerland? Is the account an Advanced Access or Verified Business Account? Check **Last event** under **Connection to TikTok**.
- **"The account was not connected" after approving.** The redirect URL in the portal must match exactly, ending in a slash. If the account had approved the app before, reconnect from Conversa (it always asks TikTok for a new code).
- **Messages stop after a while.** TikTok's direct message rules (the 48-hour window and its message caps) blocked them; the delivery fails with `WINDOW_CLOSED`. It works again once the person writes.
- **The channel needs reconnecting.** Refresh tokens last a year. If the worker was down for more than a day, the access token may also have expired; reconnect the account.
