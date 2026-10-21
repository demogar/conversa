# Self-hosting

Conversa runs as one Docker Compose stack: [`docker/compose.yml`](../docker/compose.yml).

| Service       | Image                    | Role                                                                                                                         |
| ------------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| `postgres`    | `postgres:17-alpine`     | Database. On an internal network with no route outside.                                                                      |
| `valkey`      | `valkey/valkey:8-alpine` | Queues, rate limits, caches. Append-only persistence, `noeviction` (BullMQ needs every key kept).                            |
| `migrate`     | API image                | Runs `prisma migrate deploy`, then exits. API and worker start only after it succeeds.                                       |
| `api`         | API image                | HTTP API on port 4000, not published.                                                                                        |
| `worker`      | API image                | Queue worker. Stopped with a 30 s grace period so running jobs finish.                                                       |
| `web`         | web image                | Next.js on port 3000, published on `${WEB_BIND}:${WEB_PORT}` (default `127.0.0.1:3000`). Proxies `/api` and `/l` to the API. |
| `cloudflared` | `cloudflare/cloudflared` | Optional (`--profile tunnel`). See [cloudflare.md](cloudflare.md).                                                           |

## Requirements

- A Linux host with Docker Engine and the Compose plugin. 1 vCPU and 2 GB of RAM are enough for a small installation.
- A public HTTPS hostname. Instagram only calls HTTPS webhooks, and session cookies are `Secure` (`__Host-` prefixed) when `APP_URL` is HTTPS.
- A reverse proxy or a Cloudflare Tunnel in front of the web port to terminate TLS.

## Install

```bash
git clone <your fork or this repository> conversa && cd conversa
cp .env.example .env
node scripts/generate-secrets.mjs   # or: pnpm secrets:generate
```

Paste the generated values (`SECRET_KEY`, `ENCRYPTION_KEY`, `INSTAGRAM_WEBHOOK_VERIFY_TOKEN`, `POSTGRES_PASSWORD`) into `.env`, then set at least `APP_URL`, `TRUST_PROXY` and the Instagram app values ([instagram.md](instagram.md)). `NODE_ENV` is forced to `production` by the stack.

```bash
docker compose -f docker/compose.yml --env-file .env build    # or: pnpm docker:build
docker compose -f docker/compose.yml --env-file .env up -d    # or: pnpm docker:up
docker compose -f docker/compose.yml --env-file .env ps
```

### Published images

Every release tag (`v*`) publishes multi-architecture images (amd64, arm64) to the GitHub Container Registry as `ghcr.io/<owner>/<repository>-api` and `ghcr.io/<owner>/<repository>-web`, tagged `X.Y.Z`, `X.Y` and `X`. To use them instead of building, set in `.env`:

```bash
API_IMAGE=ghcr.io/<owner>/<repository>-api:0.1
WEB_IMAGE=ghcr.io/<owner>/<repository>-web:0.1
```

and run `docker compose ... pull` before `up -d`. The published web image's API address is the compose default, `http://api:4000`; if your API runs elsewhere, build the web image yourself with `--build-arg API_INTERNAL_URL=...`.

Open `APP_URL` and create the first account. It becomes the owner of the first workspace. With `SIGNUP_MODE=invite_only` (the default), everyone after that joins by invitation.

## Configuration

All settings live in the `.env` file at the repository root. The API validates them on start and refuses to run, listing every problem, if any is wrong.

Inside the Docker stack, `NODE_ENV`, `DATABASE_URL`, `REDIS_URL`, `API_PORT` and `API_INTERNAL_URL` are set by `compose.yml` and point at the services; what `.env` says for them is ignored.

### Application

| Variable           | Default                 | Meaning                                                                                                                                                   |
| ------------------ | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`         | `development`           | `development`, `test` or `production`. Forced to `production` in Docker.                                                                                  |
| `LOG_LEVEL`        | `info`                  | `fatal`, `error`, `warn`, `info`, `debug`, `trace`. Logs are JSON in production.                                                                          |
| `APP_URL`          | (required)              | Public URL people open, without a trailing slash. OAuth redirects, webhook URLs, tracked links and the origin check use it. HTTPS makes cookies `Secure`. |
| `API_PORT`         | `4000`                  | Port the API listens on.                                                                                                                                  |
| `API_INTERNAL_URL` | `http://localhost:4000` | Where the web server reaches the API. A **build-time** setting of the web image (the rewrites are fixed at build); `http://api:4000` in Docker.           |
| `DATABASE_URL`     | (required)              | PostgreSQL connection string.                                                                                                                             |
| `DB_POOL_MAX`      | `10`                    | Database connections per process.                                                                                                                         |
| `REDIS_URL`        | (required)              | Valkey or Redis connection string.                                                                                                                        |
| `WORKER_IN_API`    | `false`                 | Run the queue processors inside the API process (small installs without a separate worker). `false` in Docker, where the worker has its own container.    |

### Secrets

| Variable                   | Default    | Meaning                                                                                                                                                                                                          |
| -------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SECRET_KEY`               | (required) | At least 32 characters (the generator makes 48 random bytes). Signs OAuth state, MFA challenges, postback buttons, link references and visitor hashes. Changing it invalidates those, not passwords or sessions. |
| `ENCRYPTION_KEY`           | (required) | 32 random bytes, base64. Encrypts provider tokens, the Buffer key and TOTP seeds (AES-256-GCM). **Losing it makes that data unreadable.**                                                                        |
| `ENCRYPTION_KEYS_PREVIOUS` | empty      | Comma-separated old keys, still accepted for decryption. See [Rotating the encryption key](#rotating-the-encryption-key).                                                                                        |

### Access

| Variable                                     | Default       | Meaning                                                                                                                        |
| -------------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `SIGNUP_MODE`                                | `invite_only` | `invite_only`: after the first account, people join only by invitation. `open`: anyone who can reach the instance can sign up. |
| `TRUST_PROXY`                                | `none`        | What is in front of the web server, to read client IPs. See [Client IPs](#client-ips-trust_proxy).                             |
| `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | empty         | Cloudflare Turnstile on sign-up, sign-in and password reset. Both or neither.                                                  |

### Mail

| Variable    | Default                         | Meaning                                                                                                                                                                     |
| ----------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SMTP_URL`  | empty                           | For example `smtps://user:password@smtp.example.com:465`. Without it, invitations show a link to copy instead of sending email, and password reset by email is unavailable. |
| `MAIL_FROM` | `Conversa <no-reply@localhost>` | Sender of invitations and password resets.                                                                                                                                  |

### Instagram

| Variable                         | Default | Meaning                                                                                                                           |
| -------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `INSTAGRAM_APP_ID`               | empty   | Instagram app ID from the Meta app dashboard.                                                                                     |
| `INSTAGRAM_APP_SECRET`           | empty   | Instagram app secret. Verifies webhook signatures and Meta's signed requests.                                                     |
| `INSTAGRAM_WEBHOOK_VERIFY_TOKEN` | empty   | Any random string; the same value goes in the Meta dashboard.                                                                     |
| `META_GRAPH_VERSION`             | `v24.0` | Graph API version, `vNN.N`.                                                                                                       |
| `INSTAGRAM_SANDBOX`              | `false` | The simulated Instagram ([sandbox.md](sandbox.md)). **Refused when `NODE_ENV=production`**, so it never runs in the Docker stack. |

Instagram is enabled only when the first three are all set.

### Docker stack only

| Variable                       | Default                                    | Meaning                                                                                  |
| ------------------------------ | ------------------------------------------ | ---------------------------------------------------------------------------------------- |
| `POSTGRES_PASSWORD`            | (required)                                 | Password of the database user.                                                           |
| `POSTGRES_USER`, `POSTGRES_DB` | `conversa`                                 | Database user and name.                                                                  |
| `WEB_BIND`                     | `127.0.0.1`                                | Host address the web port binds to. Keep `127.0.0.1` behind a reverse proxy or a tunnel. |
| `WEB_PORT`                     | `3000`                                     | Host port of the web server.                                                             |
| `TUNNEL_TOKEN`                 | empty                                      | Cloudflare Tunnel token for `--profile tunnel`.                                          |
| `API_IMAGE`, `WEB_IMAGE`       | `conversa-api:local`, `conversa-web:local` | Images to run instead of building.                                                       |
| `CONVERSA_ENV_FILE`            | `../.env`                                  | The env file the API containers read, relative to `docker/`.                             |

## Client IPs (`TRUST_PROXY`)

Rate limits, session lists and the audit log use the client IP, so it must be read correctly.

The API is always reached through the web server, which appends the address it was connected from to `X-Forwarded-For`, as a reverse proxy does. `TRUST_PROXY` says what sits **in front of the web server**:

| Value        | Reads the IP from                                      | Use when                                                                                                                                                |
| ------------ | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `none`       | the address that connected to the web server           | Nothing: browsers connect to the web port directly.                                                                                                     |
| a number `N` | `X-Forwarded-For`, trusting the entries of `N` proxies | `N` reverse proxies in front of the web server, each appending to `X-Forwarded-For`. One nginx or Caddy is `1`.                                         |
| `cloudflare` | the `CF-Connecting-IP` header                          | The app is reachable **only** through Cloudflare (a Tunnel, or a firewall that admits only Cloudflare's ranges). Otherwise anyone can forge the header. |

Entries further left than the trusted ones were written by the client and are ignored, so a client cannot choose its own address as long as `N` is not larger than the number of proxies. Each proxy must **append** to `X-Forwarded-For` (for nginx: `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;`). The API believes forwarding headers only from a peer on a private network or the same host (the web server), never from a client that reaches it directly.

## Reverse proxy

Point it at `http://127.0.0.1:3000` (or `WEB_PORT`), terminate TLS, and forward `Host`, `X-Forwarded-For` and `X-Forwarded-Proto`. Nothing else needs to be exposed. Webhooks, OAuth callbacks and tracked links all arrive on the same hostname.

## Migrations

The `migrate` service applies pending migrations every time the stack starts, before the API and worker. To run them by hand:

```bash
docker compose -f docker/compose.yml --env-file .env run --rm migrate
```

Outside Docker: `pnpm db:deploy`. Never run `pnpm db:migrate` (development only, it can reset data) against production.

## Backups

**PostgreSQL holds everything that matters.** Back it up daily and keep copies off the host:

```bash
docker compose -f docker/compose.yml --env-file .env exec -T postgres \
  pg_dump -U conversa -d conversa --format=custom > conversa-$(date +%F).dump
```

Restore into an empty database (stop `api` and `worker` first):

```bash
docker compose -f docker/compose.yml --env-file .env stop api worker
docker compose -f docker/compose.yml --env-file .env exec -T postgres \
  pg_restore -U conversa -d conversa --clean --if-exists < conversa-2026-01-01.dump
docker compose -f docker/compose.yml --env-file .env up -d
```

**Back up `.env` too**, separately and securely. Encrypted columns cannot be read without `ENCRYPTION_KEY` (or the key they were written with in `ENCRYPTION_KEYS_PREVIOUS`).

Valkey holds queued jobs, rate-limit counters and short caches. Losing it drops in-flight deliveries but no records; backing up its volume is optional.

## Upgrades

```bash
git pull
docker compose -f docker/compose.yml --env-file .env build   # or `pull` with published images
docker compose -f docker/compose.yml --env-file .env up -d
```

Migrations run automatically on start. Take a database backup before upgrading, and read [CHANGELOG.md](../CHANGELOG.md) for anything that needs attention.

## Rotating the encryption key

1. Generate a new key: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`.
2. Move the current `ENCRYPTION_KEY` to `ENCRYPTION_KEYS_PREVIOUS` (comma-separated if there are several) and set the new one as `ENCRYPTION_KEY`.
3. Restart the stack. New values are written with the new key; old ones still decrypt. The `refresh-tokens` maintenance job (every 6 hours) re-encrypts channel credentials written with an old key.
4. Remove an old key only once nothing encrypted with it is left. Buffer keys and TOTP seeds are re-encrypted when they are next saved; reconnecting Buffer or re-enrolling 2FA moves them to the new key.

## Scaling

- **Worker.** Run more workers to process more events: `docker compose ... up -d --scale worker=3`. The private-reply budget, job ids and maintenance schedules are shared through Valkey, so workers never double-send or exceed Instagram's limits together.
- **API.** Stateless: sessions are in PostgreSQL and rate limits in Valkey. Several replicas can run behind one web server or load balancer.
- **Database.** Each process opens up to `DB_POOL_MAX` connections; keep the total under PostgreSQL's `max_connections`.
- **Health checks.** `GET /api/v1/health` (process up) and `GET /api/v1/health/ready` (database and Valkey answer).

## Logs

Every service logs JSON to stdout, rotated by Docker (10 MB, 3 files). Each API response carries an `X-Request-Id` that appears in the log lines for that request and in error bodies. Cookies, authorization headers, webhook signatures, passwords, tokens, API keys and query strings are never logged.
