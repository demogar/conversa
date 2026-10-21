# Connecting Instagram

Conversa uses Meta's **Instagram API with Instagram Login**. Each installation needs its own Meta app; every Instagram account your team connects authorises that app.

Want to try Conversa first? The [sandbox](sandbox.md) needs no Meta app at all.

## Before you start

- Conversa running on a public **HTTPS** URL (`APP_URL`). Meta does not call plain-HTTP webhooks.
- The Instagram accounts you will connect must be **professional accounts** (Business or Creator). Personal accounts cannot use the messaging API.
- A Meta developer account at [developers.facebook.com](https://developers.facebook.com).

The URLs below use `https://conversa.example.com` for `APP_URL`.

## 1. Create the app

1. **My Apps → Create app.** Choose the use case for managing messaging and content on Instagram (the dashboard names it along the lines of "Manage messaging & content on Instagram"), and the app type **Business** if asked.
2. In the app, open **Instagram → API setup with Instagram business login**.
3. Copy the **Instagram app ID** and **Instagram app secret** shown there. They are not the same as the Meta app ID at the top of the dashboard.

```bash
INSTAGRAM_APP_ID=<Instagram app ID>
INSTAGRAM_APP_SECRET=<Instagram app secret>
INSTAGRAM_WEBHOOK_VERIFY_TOKEN=<random string; pnpm secrets:generate makes one>
```

Restart the API. The channels page now offers to connect Instagram.

## 2. Permissions

Conversa asks for exactly these:

| Permission                           | Used for                                             |
| ------------------------------------ | ---------------------------------------------------- |
| `instagram_business_basic`           | The account's profile, posts and reels               |
| `instagram_business_manage_messages` | Sending and reading direct messages, private replies |
| `instagram_business_manage_comments` | Reading comments and posting public replies          |

## 3. Business login (OAuth)

Under **Set up Instagram business login → Business login settings**:

| Setting                   | Value                                                                   |
| ------------------------- | ----------------------------------------------------------------------- |
| OAuth redirect URI        | `https://conversa.example.com/api/v1/channels/oauth/instagram/callback` |
| Deauthorize callback URL  | `https://conversa.example.com/api/v1/webhooks/instagram/deauthorize`    |
| Data deletion request URL | `https://conversa.example.com/api/v1/webhooks/instagram/data-deletion`  |

The redirect URI must match `APP_URL` exactly, scheme and host included.

- **Deauthorize**: when someone removes the app from their Instagram account, Conversa disconnects that channel.
- **Data deletion**: Conversa deletes the channel and everything learned through it (contacts, deliveries), and answers Meta with a status URL under `/legal/data-deletion`.

Both callbacks carry a `signed_request` verified with the app secret.

## 4. Webhooks

Under **Configure webhooks**:

| Setting      | Value                                                    |
| ------------ | -------------------------------------------------------- |
| Callback URL | `https://conversa.example.com/api/v1/webhooks/instagram` |
| Verify token | the value of `INSTAGRAM_WEBHOOK_VERIFY_TOKEN`            |

Click **Verify and save**. Meta calls the URL with a challenge, and Conversa answers only if the token matches. Then subscribe these fields:

| Field                 | Why                                         |
| --------------------- | ------------------------------------------- |
| `comments`            | Comment triggers                            |
| `messages`            | DM and story-reply triggers                 |
| `messaging_postbacks` | Taps on the opening and follow-gate buttons |

Every webhook is checked against its `X-Hub-Signature-256` HMAC (the app secret) and rejected with `401` if it does not match.

Conversa subscribes each account to the app's webhooks when it is connected, so there is nothing to do per account.

## 5. App settings

Under **App settings → Basic**:

| Setting                           | Value                                        |
| --------------------------------- | -------------------------------------------- |
| Privacy policy URL                | `https://conversa.example.com/legal/privacy` |
| Terms of service URL              | `https://conversa.example.com/legal/terms`   |
| User data deletion                | Data deletion callback URL, as above         |
| App icon, category, contact email | Your own                                     |

The legal pages are public and ship with Conversa. Review their text and adapt it to how you run your installation.

## 6. Connect an account

On the Instagram account itself, in the Instagram app: **Settings → Messages and story replies → Message controls → Connected tools**, turn on **Allow access to messages**. Without it the messaging API refuses to send.

Then in Conversa, an owner or admin opens **Channels → Connect Instagram**, signs in to Instagram and approves the permissions. One workspace can connect several accounts; an account can belong to only one workspace at a time.

Tokens are long-lived (60 days) and refreshed automatically by the worker well before they expire. If a token stops working, the channel shows **Needs reconnecting**.

## 7. Development mode and going live

While the app is in **development mode**, only people with a role on the app (admins, developers, testers added under **App roles**) can connect their accounts, and webhooks are delivered only for those accounts. That is enough for a single team managing its own accounts.

To connect accounts that do not have a role on the app, the app needs **Advanced Access** for the three permissions, which means **App Review** (and usually **business verification**). Notes for the review:

- **Screencast**: show connecting an account, creating a comment automation with a keyword, commenting from a second account, and the private reply arriving. Then a DM automation, and the public reply under the comment.
- **Why each permission**: `instagram_business_basic` lists the account's posts so the person can choose which posts an automation listens to; `instagram_business_manage_comments` receives comments and posts the optional public reply; `instagram_business_manage_messages` sends the private reply and DMs the person asked for.
- **Test credentials**: give the reviewers an account on your Conversa instance, and say which keyword to comment.
- Messages are sent only in response to the person's own comment, message or button tap. Conversa never sends unsolicited messages.

Finally switch the app to **Live**.

## Platform limits

Conversa works within Meta's rules and enforces some of them itself:

| Limit                                        | What Conversa does                                                                                                                                           |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **750 private replies per hour** per account | A shared per-account budget. When it is spent, deliveries wait for the next window (up to six windows), then are skipped as rate-limited.                    |
| **One private reply per comment**            | At most one automation answers each comment. Further messages to that person go through the normal DM path after they reply or tap a button.                 |
| **24-hour messaging window**                 | Messages can be sent only within 24 hours of the person's last message or tap. A send after the window closes fails as a permanent error and is not retried. |
| **Professional accounts only**               | Personal accounts cannot be connected.                                                                                                                       |
| Button template                              | 640 characters of text, up to three buttons, 20-character button labels. The automation editor enforces these.                                               |

Conversa ignores the account's own comments and messages (including its own replies), so automations cannot trigger themselves.

## Moving from another DM automation tool

Only one tool should answer a conversation.

1. **Pause or delete** the automations in the old tool for the posts and keywords you are moving.
2. **Hand conversation control to Conversa.** If the account has several apps connected for messaging, set Conversa's app as the one that handles conversations (in Meta Business Suite's inbox settings, or the Instagram app's **Connected tools**), or remove the old tool's access in **Settings → Apps and websites**. Otherwise the old tool may still receive and answer the same messages, or the platform may route them away from Conversa.
3. Connect the account in Conversa and recreate the automations. Start them as drafts, test with a second account, then activate.
4. If an automation should fire only on posts published from now on, use the **next post** scope so it does not answer old comments.

## Troubleshooting

| Symptom                                               | Check                                                                                                                                                                    |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Verify and save fails                                 | `APP_URL` is reachable over HTTPS from the internet; the verify token matches; a WAF or Access is not challenging `/api/v1/webhooks/*` ([cloudflare.md](cloudflare.md)). |
| Connect returns to Channels with an error             | The OAuth redirect URI matches exactly; the Instagram app ID and secret (not the Meta app ID) are in `.env`; in development mode, the account has a role on the app.     |
| Comments arrive but no DM is sent                     | **Allow access to messages** is on; the automation is active and its keywords match; check **Activity** for the delivery and its skip or error reason.                   |
| Channel shows Needs reconnecting                      | The token was revoked or the password changed. Reconnect it from Channels.                                                                                               |
| API logs `Rejected webhook with an invalid signature` | `INSTAGRAM_APP_SECRET` is the Instagram app secret of this app.                                                                                                          |
