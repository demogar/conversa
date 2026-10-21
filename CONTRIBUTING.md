# Contributing to Conversa

Thanks for helping. Bug reports, fixes, translations, docs and new platform providers are all welcome.

## Before you start

- **Bugs**: open an issue with what you did, what you expected and what happened, plus the version or commit. Logs help; remove tokens, emails and hostnames first.
- **Features**: open an issue to discuss it before writing a large change, so nobody's work is wasted.
- **Security problems**: never in a public issue. See [SECURITY.md](SECURITY.md).

Everyone taking part follows the [code of conduct](CODE_OF_CONDUCT.md).

## Setting up

See the [quick start](README.md#quick-start-local-development). In short:

```bash
pnpm install
cp .env.example .env && pnpm secrets:generate   # paste the output into .env
pnpm infra:up && pnpm db:migrate
pnpm dev            # API and web
pnpm dev:worker     # the queue worker
```

Set `INSTAGRAM_SANDBOX=true` to work without a Meta app ([docs/sandbox.md](docs/sandbox.md)).

## Making a change

1. Fork, then branch from `main`: `feat/<short-name>`, `fix/<short-name>`, `docs/<short-name>`.
2. Read the guide for the part you touch:
   - [Backend guide](docs/contributing/backend-guide.md): modules, error codes, validation, roles, adding an endpoint.
   - [Frontend guide](docs/contributing/frontend-guide.md): Mola UI only, states, translations, roles.
   - [Architecture](docs/architecture.md): the pipeline, the delivery state machine, adding a platform.
3. Keep changes focused. A refactor and a feature are two pull requests.
4. Add or update tests ([docs/testing.md](docs/testing.md)).
5. Run the gate:

   ```bash
   pnpm check   # prettier, lint, typecheck, unit tests
   ```

   Run `pnpm --filter @conversa/api test:integration` too when you change the API's routes, guards or the engine.

6. Commit with [Conventional Commits](https://www.conventionalcommits.org/): `feat(engine): retry deliveries after a rate limit`, `fix(web): keep the draft when saving fails`, `docs: explain TRUST_PROXY`.
7. Open the pull request with a Conventional Commit **title** (a check enforces it): say what changed and why, how you tested it, and include a screenshot for UI changes. Do not edit [CHANGELOG.md](CHANGELOG.md); it is generated at release time.

Pull requests are squash-merged: the PR title becomes the commit message on `main`, and the PR description its body. All checks must pass and every review conversation must be resolved before merging.

## Releases

Releases are automated with [release-please](https://github.com/googleapis/release-please) and follow [Semantic Versioning](https://semver.org/).

- **Commit types.** The PR title decides what the change does to the version and where it lands in the changelog. Allowed types: `feat`, `fix`, `perf`, `security`, `deps`, `refactor`, `docs`, `revert` (listed in the changelog) and `test`, `build`, `ci`, `chore` (left out). A `!` after the type (`feat!: ...`) or a `BREAKING CHANGE:` footer marks a breaking change.
- **Version bumps.** `fix`, `perf` and the other listed types bump the patch version, `feat` the minor version, and a breaking change the major version. Before 1.0.0 a breaking change bumps the minor version instead.
- **Release PR.** Every push to `main` updates one open pull request titled `chore: release X.Y.Z`. It bumps the version in the root `package.json` and in every app and package `package.json` together, and adds the new section to `CHANGELOG.md`. Merging it is the release: release-please tags `vX.Y.Z` and publishes the GitHub release.
- **Images.** The same workflow then builds and pushes the multi-architecture `api` and `web` images to the GitHub Container Registry, tagged `X.Y.Z`, `X.Y` and `X` (`.github/workflows/release-images.yml`). A `v*` tag pushed by hand builds them too.
- **Checks on the release PR.** release-please uses the workflow's `GITHUB_TOKEN`, and GitHub does not start workflows for pull requests or tags created with that token. Close and reopen the release PR to run the required checks before merging it. The image build does not depend on the tag event: the release workflow calls it directly.
- Release tags are protected: they cannot be moved or deleted once created.

Configuration: `release-please-config.json`, `.release-please-manifest.json` (the current version) and `.github/workflows/release.yml`.

## Project rules

These are checked in review:

- **No secrets, real hostnames, IPs or personal data** anywhere in the repository: code, tests, fixtures, docs, commit messages. Use `example.com` and obviously fake values.
- **Every visible word is translated**, in English and Spanish, same keys. The API returns error codes, never sentences.
- **UI comes only from [Mola UI](https://demogar.github.io/molaui/)** (`@demogar/mola-ui`). No other component library, no hand-rolled buttons, inputs or dialogs.
- **Validation lives in `@conversa/shared`** as zod schemas used by both apps.
- **Every workspace query is scoped by `workspaceId`.**
- **Talk to platforms only through the provider interface.**
- Comments explain _why_, not _what_.

## Translations

Improving the Spanish text, or adding a language, is a great first contribution. See [docs/i18n.md](docs/i18n.md).

## License

By contributing you agree that your contribution is licensed under the [MIT License](LICENSE).
