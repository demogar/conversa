# Security

Conversa holds access to other people's Instagram accounts and to their audiences' messages. This page summarises how it protects them, and how to report a problem.

## Reporting a vulnerability

**Please do not open a public issue for a security problem.**

Report it privately through GitHub: on this repository, open **Security → Advisories → Report a vulnerability**. Include what you found, how to reproduce it, and the version or commit. You will get an acknowledgement, and a fix and advisory will be coordinated with you before anything is published.

Only the latest release and `main` receive security fixes.

## Threat model in brief

| Asset                                            | Threats considered                                                            |
| ------------------------------------------------ | ----------------------------------------------------------------------------- |
| Instagram access tokens, Buffer keys, TOTP seeds | Database leak, backup leak, log leak                                          |
| Team accounts                                    | Credential stuffing, brute force, session theft, CSRF, phishing of one factor |
| Workspace data                                   | A member of one workspace reading or changing another's                       |
| Webhooks and callbacks                           | Forged events triggering messages; forged deauthorize or deletion calls       |
| Link buttons and postbacks                       | Forged taps advancing someone else's delivery; click inflation                |
| The dashboard                                    | XSS, clickjacking                                                             |

Out of scope: an attacker with shell access to the host or to the `.env` file, and the security of Meta's and Buffer's platforms themselves.

## Controls

### Authentication

- **Passwords** hashed with **argon2id** (19 MiB, 2 iterations, OWASP parameters); 12 to 128 characters. Unknown emails take the same time as wrong passwords.
- **Account lockout**: every fifth consecutive failure (counted atomically, so parallel guesses all count) locks the account, for 15 minutes first and twice as long each time after, up to 24 hours.
- **Two-factor authentication**: TOTP (RFC 6238, one step of clock drift), with 8 one-time recovery codes stored as hashes. A TOTP code is accepted **once**: a replay within its window is rejected, and a recovery code cannot be used twice even by requests racing with it.
- **Turnstile** (optional) on sign-up, sign-in and password reset.
- **Sign-up** is invite-only by default after the first account.
- Password reset and invitation tokens are random, single-use, expiring, and stored only as SHA-256 hashes.

### Sessions

- Server-side sessions. The cookie holds a random 256-bit token; the database stores only its **SHA-256 hash**.
- The cookie is **httpOnly**, **SameSite=Lax**, and on HTTPS **Secure** with the **`__Host-`** prefix (host-only, path `/`, cannot be set by a subdomain).
- 30-day sliding expiry. People can see and revoke their sessions; changing the password signs out the others.

### Requests

- **CSRF**: on top of SameSite cookies, every state-changing request must carry an `Origin` equal to `APP_URL`'s origin (or `Sec-Fetch-Site: same-origin`). Only signed server-to-server callbacks skip the check.
- **Rate limits** in Valkey, shared by every API process, keyed by the client IP. The web server appends the address it was connected from to `X-Forwarded-For`; the API trusts only as many entries as `TRUST_PROXY` declares proxies, and ignores forwarding headers from anything but a private-network peer, so a client cannot pick its own address. Limits: 300 requests per minute in general, 10 per minute on sign-in, sign-up, MFA and reset (blocked 5 minutes after), 5 per 15 minutes for reset emails.
- **Validation**: every body and query goes through a zod schema shared with the web app. JSON bodies are capped at 256 KB.
- **Errors** are stable codes; stack traces and internal messages never reach clients.

### Tenant isolation

- Every workspace-owned row carries `workspaceId` and every query filters by it.
- A global guard checks membership on every `/workspaces/:workspaceId/...` route. A workspace you do not belong to answers **404**, so ids cannot be probed.
- Roles: `MEMBER` builds automations and uses the inbox; `ADMIN` also manages channels, integrations, members, invitations and reads the audit log; `OWNER` also manages owners and deletes the workspace. A workspace always keeps at least one owner.
- An Instagram account can be connected to only one workspace at a time.

### Secrets at rest

- Provider tokens, the Buffer API key and TOTP seeds are encrypted with **AES-256-GCM** (random 96-bit IV, authenticated). Each value records which key encrypted it.
- **Key rotation**: set a new `ENCRYPTION_KEY` and keep old keys in `ENCRYPTION_KEYS_PREVIOUS`; old values still decrypt, and the worker re-encrypts channel credentials with the current key. See [docs/self-hosting.md](docs/self-hosting.md#rotating-the-encryption-key).
- Signing keys are derived per purpose from `SECRET_KEY` with HKDF, so a signature made for one feature is never valid for another.

### Platform callbacks and links

- **Webhooks** are verified with the `X-Hub-Signature-256` HMAC over the raw body (constant-time comparison). Unsigned or mis-signed requests get `401` and are not stored.
- **Deauthorize and data deletion** callbacks verify Meta's `signed_request`.
- **OAuth state** is signed, expires, and is bound to the person and workspace that started the flow.
- **Postback buttons** carry a signed delivery reference: nobody can craft a tap that advances another person's delivery.
- **Tracked links** carry a signed delivery reference. Clicks store a keyed hash of the visitor's IP, never the IP. Redirects send `no-store` and `no-referrer`.

### The web app

- A **strict Content Security Policy with a per-request nonce** and `strict-dynamic`; `frame-ancestors 'none'`, `form-action 'self'`, `object-src 'none'`. The API sends `default-src 'none'`.
- `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, a restrictive `Permissions-Policy`, `Cross-Origin-Opener-Policy: same-origin`, HSTS on HTTPS.
- The browser talks to one origin; the API is reached through the web server.

### Audit and logs

- An **audit log** records account security events (sign-up, sign-in, password and 2FA changes) and workspace actions (members, invitations, channels, Buffer, automations, inbox replies) with actor, target and, where known, IP. Admins see their workspace's entries in the settings.
- Logs are **redacted**: cookies, `Authorization`, webhook signatures, `Set-Cookie`, passwords, tokens, API keys and codes are replaced with `[redacted]`, and query strings are never logged.

### Deployment

- Containers run as an unprivileged user; the database and Valkey sit on an internal network with no route outside; only the web port is published, on `127.0.0.1` by default.
- The sandbox (simulated Instagram) refuses to run in production.

## Hardening checklist for operators

- [ ] `APP_URL` is HTTPS.
- [ ] `SECRET_KEY` and `ENCRYPTION_KEY` were generated with `pnpm secrets:generate` and are not reused elsewhere.
- [ ] `.env` is readable only by the user that runs Docker, and backed up securely.
- [ ] `TRUST_PROXY` matches your proxy setup ([docs/self-hosting.md](docs/self-hosting.md#client-ips-trust_proxy)).
- [ ] `SIGNUP_MODE=invite_only` unless you mean to run a public instance.
- [ ] Owners and admins have 2FA enabled.
- [ ] Database backups are encrypted and stored off the host.
