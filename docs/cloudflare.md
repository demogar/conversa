# Running behind Cloudflare

Cloudflare is optional, but it gives a self-hosted Conversa three useful things: no inbound port on your server (Tunnel), edge rate limiting (WAF), and a bot check on the sign-in forms (Turnstile).

## 1. Cloudflare Tunnel

The compose file has a `cloudflared` service in the `tunnel` profile. With it the host needs no open port at all.

1. In the Cloudflare dashboard, open **Zero Trust → Networks → Tunnels** and create a tunnel of type **Cloudflared**. Copy its token.
2. Add a **public hostname** to the tunnel, for example `conversa.example.com`, with service `HTTP` and URL `web:3000` (the compose service name, reached on the stack's network).
3. In `.env`:

   ```bash
   APP_URL=https://conversa.example.com
   TRUST_PROXY=cloudflare
   TUNNEL_TOKEN=<the token>
   ```

4. Start the stack with the profile:

   ```bash
   docker compose -f docker/compose.yml --env-file .env --profile tunnel up -d
   ```

The tunnel creates the proxied DNS record for the hostname. Leave `WEB_BIND=127.0.0.1` so the web port is not reachable from the network either.

### DNS and proxy without a tunnel

If you run your own reverse proxy instead, make the hostname's DNS record **proxied** (orange cloud), set SSL/TLS to **Full (strict)**, and firewall the origin so it accepts traffic **only from Cloudflare's IP ranges**. `TRUST_PROXY=cloudflare` trusts the `CF-Connecting-IP` header, which anyone could forge if the origin were reachable directly. If you cannot restrict the origin, use a hop count instead (see [self-hosting.md](self-hosting.md#client-ips-trust_proxy)).

## 2. WAF rules

Conversa already rate-limits in the app (Redis-backed, per client IP, with account lockout). Edge rules stop abuse before it reaches your server.

### Rate limiting on authentication

**Security → WAF → Rate limiting rules → Create rule:**

| Field                      | Value                                                                                     |
| -------------------------- | ----------------------------------------------------------------------------------------- |
| If incoming requests match | `starts_with(http.request.uri.path, "/api/v1/auth/")` and `http.request.method eq "POST"` |
| Characteristics            | IP                                                                                        |
| Rate                       | 20 requests per 1 minute (lower on paid plans, which allow longer periods)                |
| Action                     | Block (or Managed Challenge), for 10 minutes                                              |

Optionally a second, looser rule on `/api/v1/invitations/` (invitation lookup and accept).

### Let Meta's webhooks through

Meta calls `/api/v1/webhooks/instagram` (and the deauthorize and data deletion callbacks under it) from its servers. A challenge page there means lost events. Every call is verified by its HMAC signature, so the path does not need bot protection.

**Security → WAF → Custom rules → Create rule:**

| Field                      | Value                                                                                                                      |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| If incoming requests match | `starts_with(http.request.uri.path, "/api/v1/webhooks/")`                                                                  |
| Action                     | Skip: all remaining custom rules, rate limiting rules, managed rules, and Super Bot Fight Mode (where your plan offers it) |
| Order                      | First                                                                                                                      |

On the Free plan, **Bot Fight Mode** cannot be skipped by a rule. If webhooks stop arriving (the Meta dashboard shows failed deliveries), turn Bot Fight Mode off for the zone.

Also keep **Browser Integrity Check** and any "I'm Under Attack" mode from applying to `/api/v1/webhooks/*` and `/l/*` (tracked links opened from the Instagram app).

### Caching

Cloudflare does not cache HTML or API responses by default, and tracked-link redirects send `Cache-Control: no-store` so every click is counted. Do not add a "Cache Everything" rule for the hostname.

## 3. Turnstile

Turnstile adds a bot check to sign-up, sign-in and password reset.

1. In the dashboard, open **Turnstile → Add widget**. Hostname: your `APP_URL` host. Widget mode: **Managed**.
2. Copy the keys into `.env`:

   ```bash
   TURNSTILE_SITE_KEY=<site key>
   TURNSTILE_SECRET_KEY=<secret key>
   ```

3. Restart `api`. The sign-in screens read the site key from `GET /api/v1/instance` and show the widget; the API verifies each token server-side. Set both keys or neither.

The app's Content Security Policy already allows `https://challenges.cloudflare.com` for scripts and frames.

## 4. Cloudflare Access (optional)

Access can require a login (email code, SSO) before anyone even sees the dashboard. Conversa still enforces its own sign-in behind it.

**Some paths must stay public**, because they are opened by Meta's servers or by people who are not Conversa users:

| Path                 | Opened by                                                                       |
| -------------------- | ------------------------------------------------------------------------------- |
| `/api/v1/webhooks/*` | Meta: webhooks, deauthorize and data deletion callbacks                         |
| `/l/*`               | Anyone who taps a link button in a DM                                           |
| `/legal/*`           | Meta's app review and anyone reading the privacy policy or data deletion status |

Set it up in **Zero Trust → Access → Applications**:

1. A **self-hosted application** for `conversa.example.com` (the whole hostname) with an **Allow** policy for your team.
2. Three more self-hosted applications on the same hostname, with paths `api/v1/webhooks/*`, `l/*` and `legal/*`, each with a single **Bypass** policy (include: Everyone). Access applies the most specific path, so these stay open.

The OAuth callback (`/api/v1/channels/oauth/instagram/callback`) is a browser redirect for a team member who is already through Access, so it can stay behind it.

## Checklist

- [ ] `APP_URL` is the `https://` hostname Cloudflare serves.
- [ ] `TRUST_PROXY=cloudflare`, and the origin is reachable only through Cloudflare.
- [ ] Rate-limiting rule on `/api/v1/auth/*`.
- [ ] Skip rule for `/api/v1/webhooks/*`; Bot Fight Mode off if webhooks are challenged.
- [ ] Turnstile keys set (both).
- [ ] If Access is on: bypass for `/api/v1/webhooks/*`, `/l/*`, `/legal/*`.
