# Connecting Instagram

Conversa uses Meta's **Instagram API with Instagram Login**. Each installation needs its own Meta app; every Instagram account your team connects authorises that app.

Want to try Conversa first? The [sandbox](sandbox.md) needs no Meta app at all.

The same guide is built into Conversa: **Instance settings → Instagram app** (account menu, instance admins only) and the first-run setup show it one step at a time, with this installation's real addresses and a copy button for each, next to a [connection status](#connection-status) that tells you whether Meta's side works.

## Before you start

- Conversa running on a public **HTTPS** URL (`APP_URL`). Meta does not call plain-HTTP webhooks.
- The Instagram accounts you will connect must be **professional accounts** (Business or Creator). Personal accounts cannot use the messaging API.
- A Meta developer account at [developers.facebook.com](https://developers.facebook.com).

The addresses below use `${APP_URL}` for your installation's address, for example `https://conversa.example.com`.

> Menu names are as of 2026. Meta renames them now and then; look for the closest match.

## 1. Create the app

**Where:** [developers.facebook.com/apps](https://developers.facebook.com/apps) → **Create app**.

Name the app, choose the use case **Manage messaging & content on Instagram**, and the app type **Business** if asked. Connecting a business portfolio is optional.

## 2. Copy the Instagram app ID and secret into Conversa

**Where:** your app → **Use cases** → **Manage messaging & content on Instagram** → **Customize** → **API setup with Instagram login**.

You'll see the Instagram app name, the **Instagram app ID** and the **Instagram app secret** (click **Show**).

In Conversa, open **Instance settings → Instagram app**. Paste the app ID and the app secret, click **Generate token** for the webhook verify token (or type any random string), and **save**. It applies at once, with no restart. The app secret and the verify token are stored encrypted and never shown again; **Replace** sets a new one. The guide keeps a token you just generated on screen so you can paste it in the next step.

> **Common mistake:** the Instagram app ID is **not** the App ID at the top of the dashboard or under **App settings → Basic**. That one is the Facebook app ID, and using it ends in `Invalid redirect_uri` or `Invalid platform app` when you connect an account.

## 3. Webhooks

**Where:** **API setup with Instagram login** → **Configure webhooks**.

| Meta field   | Value                                  |
| ------------ | -------------------------------------- |
| Callback URL | `${APP_URL}/api/v1/webhooks/instagram` |
| Verify token | the verify token you saved in step 2   |

Click **Verify and save**. Meta calls the URL with a challenge, and Conversa answers only if the token matches. Then turn on **Subscribe** for these fields:

| Field                 | Why                                         |
| --------------------- | ------------------------------------------- |
| `comments`            | Comment triggers                            |
| `messages`            | DM and story-reply triggers                 |
| `messaging_postbacks` | Taps on the opening and follow-gate buttons |

Every webhook is checked against its `X-Hub-Signature-256` HMAC (the app secret) and rejected with `401` if it does not match. Conversa subscribes each account to the app's webhooks when it is connected, so there is nothing to do per account.

> **Common mistake:** save the app in Conversa **before** clicking **Verify and save**. Meta checks the token right away, and the check fails if Conversa does not have it yet.

## 4. Business login settings

**Where:** **API setup with Instagram login** → **Set up Instagram business login** → **Business login settings**.

| Meta field                | Value                                                 |
| ------------------------- | ----------------------------------------------------- |
| OAuth redirect URIs       | `${APP_URL}/api/v1/channels/oauth/instagram/callback` |
| Deauthorize callback URL  | `${APP_URL}/api/v1/webhooks/instagram/deauthorize`    |
| Data deletion request URL | `${APP_URL}/api/v1/webhooks/instagram/data-deletion`  |

The redirect URI must match `APP_URL` exactly, scheme and host included.

- **Deauthorize**: when someone removes the app from their Instagram account, Conversa disconnects that channel.
- **Data deletion**: Conversa deletes the channel and everything learned through it (contacts, deliveries), and answers Meta with a status URL under `/legal/data-deletion`.

Both callbacks carry a `signed_request` verified with the app secret.

> **Common mistake:** the redirect URI goes **here**, in Instagram's business login settings, not under **Facebook Login → Settings → Valid OAuth Redirect URIs**. Instagram ignores that list and answers `Invalid redirect_uri`.

## 5. App settings → Basic

**Where:** **App settings** → **Basic**.

| Meta field                                      | Value                                                |
| ----------------------------------------------- | ---------------------------------------------------- |
| Privacy Policy URL                              | `${APP_URL}/legal/privacy`                           |
| Terms of Service URL                            | `${APP_URL}/legal/terms`                             |
| User data deletion → Data deletion callback URL | `${APP_URL}/api/v1/webhooks/instagram/data-deletion` |
| App icon                                        | 1024 × 1024 pixels                                   |
| Category, contact email                         | Your own                                             |

The legal pages are public and ship with Conversa. Review their text and adapt it to how you run your installation.

> **Common mistake:** without an app icon of exactly 1024 × 1024 pixels, a privacy policy and terms of service, Meta will not let you switch the app to Live in step 8.

## 6. Roles: add the account as an Instagram Tester

**Where:** **App roles** → **Roles** → **Add people** → **Instagram Tester**, and enter the Instagram username of each account you will connect.

Then accept the invite **from Instagram**: signed in as that account, open [instagram.com/accounts/manage_access](https://www.instagram.com/accounts/manage_access/) → **Tester invites** → **Accept**.

> **Common mistake:** an account that is not an accepted Instagram Tester fails to connect with `Insufficient developer role`. The invite counts only once it is accepted on Instagram.

## 7. The Instagram account

In the Instagram app, on the account itself:

- **Settings and activity → Account type and tools**: make it a professional account (Business or Creator).
- **Settings and activity → Messages and story replies → Connected tools**: turn on **Allow access to messages**.

> **Common mistake:** with **Allow access to messages** off, direct messages never reach Conversa and private replies cannot be sent, even when comments arrive.

## 8. Publish: switch the app to Live

**Where:** **Publish** in the left menu, or the **App mode** switch at the top of the dashboard.

Fix anything the checklist marks (usually the icon, privacy policy or terms from step 5), then publish until **App mode** shows **Live**.

> **Common mistake:** while the app is in **Development mode**, Meta does not send real webhooks. **Verify and save** works, but comments and messages never reach Conversa.

Live with standard access is enough for accounts that have a role on the app, which suits a team managing its own accounts. To connect accounts that do not have a role on the app, the app needs **Advanced Access** for the three permissions, which means **App Review** (and usually **business verification**). Notes for the review:

- **Screencast**: show connecting an account, creating a comment automation with a keyword, commenting from a second account, and the private reply arriving. Then a DM automation, and the public reply under the comment.
- **Why each permission**: `instagram_business_basic` lists the account's posts so the person can choose which posts an automation listens to; `instagram_business_manage_comments` receives comments and posts the optional public reply; `instagram_business_manage_messages` sends the private reply and DMs the person asked for.
- **Test credentials**: give the reviewers an account on your Conversa instance, and say which keyword to comment.
- Messages are sent only in response to the person's own comment, message or button tap. Conversa never sends unsolicited messages.

## 9. Connect the account in Conversa

An owner or admin opens **Channels → Connect Instagram account**, signs in to Instagram as the tester account and approves the permissions. One workspace can connect several accounts; an account can belong to only one workspace at a time.

Then comment on one of the account's posts from another account. Within a minute the channel card shows **Last event**, and the connection status shows **Last event from Instagram**.

Tokens are long-lived (60 days) and refreshed automatically by the worker well before they expire. If a token stops working, the channel shows **Needs reconnecting**.

## Permissions

Conversa asks for exactly these:

| Permission                           | Used for                                             |
| ------------------------------------ | ---------------------------------------------------- |
| `instagram_business_basic`           | The account's profile, posts and reels               |
| `instagram_business_manage_messages` | Sending and reading direct messages, private replies |
| `instagram_business_manage_comments` | Reading comments and posting public replies          |

## Connection status

**Instance settings → Instagram app** (and the Channels page, for instance admins) shows what Conversa can tell about Meta's side:

| Row                       | Meaning                                                                                                                                                                                                                                                                                                                               |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| App ID and secret         | Meta has no endpoint that checks an Instagram Login app's ID and secret on their own. Conversa asks Meta to exchange a sign-in code that cannot work and reads the refusal: a complaint about the code means the app ID and secret passed, a complaint about the app or secret means they did not. Anything else is "Could not tell". |
| Webhook verified          | When Meta's **Verify and save** last reached this installation with the right token.                                                                                                                                                                                                                                                  |
| Last event from Instagram | When a webhook with a valid signature last arrived, for any account. Each channel card shows the same for its own account.                                                                                                                                                                                                            |

If the webhook was verified more than 15 minutes ago and nothing has arrived since, or an account has been connected for 15 minutes without an event, Conversa asks whether the app is Live and **Allow access to messages** is on. The credentials are never shown or logged by these checks.

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

| Error or symptom                                              | Cause                                                                                                               | Fix                                                                                                                                                                                            |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Invalid redirect_uri` when connecting                        | The Facebook app ID was saved instead of the Instagram app ID, or the redirect URI was pasted under Facebook Login. | Save the **Instagram app ID** and secret from **API setup with Instagram login** (step 2), and paste the OAuth redirect URI under Instagram's **Business login settings** (step 4).            |
| `Insufficient developer role` when connecting                 | The Instagram account has no role on the app, or its tester invite was not accepted.                                | Add it under **App roles → Roles → Instagram Tester**, then accept at [instagram.com/accounts/manage_access](https://www.instagram.com/accounts/manage_access/) → **Tester invites** (step 6). |
| Verify and save works, but no comment or message ever arrives | The Meta app is still in **Development mode**: Meta does not send real webhooks.                                    | Add the app icon (1024 × 1024), privacy policy and terms (step 5), then **Publish** to Live (step 8).                                                                                          |
| Comments arrive, but DMs never do and private replies fail    | **Allow access to messages** is off on the Instagram account.                                                       | In the Instagram app: **Settings → Messages and story replies → Connected tools → Allow access to messages** (step 7).                                                                         |
| Verify and save fails                                         | The verify token was not saved in Conversa first, or `APP_URL` is not reachable over HTTPS.                         | Save the app in Conversa, then verify again. Check that a WAF or Access is not challenging `/api/v1/webhooks/*` ([cloudflare.md](cloudflare.md)).                                              |
| Connect returns to Channels with another error                | The redirect URI does not match `APP_URL` exactly.                                                                  | Compare the scheme and host with the OAuth redirect URI shown in Instance settings.                                                                                                            |
| Comments arrive but no DM is sent                             | The automation is not active or its keywords do not match.                                                          | Check **Activity** for the delivery and its skip or error reason.                                                                                                                              |
| Channel shows Needs reconnecting                              | The token was revoked or the password changed.                                                                      | Reconnect it from Channels.                                                                                                                                                                    |
| API logs `Rejected webhook with an invalid signature`         | The app secret in Instance settings is not this app's Instagram app secret.                                         | Replace it with the Instagram app secret from step 2.                                                                                                                                          |
