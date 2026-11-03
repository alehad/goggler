# goggler

Personal eBay UK auction tracker for finding items that reappear after lost bids.

## Current application

goggler has a Next.js web app and a native SwiftUI macOS app, both using the same backend. It remains a personal, single-user application with a seeded local identity, rather than a general multi-user service.

- Connect an eBay account through OAuth and import current watchlist, won items, and lost auctions.
- Preserve normalized won and lost history after it ages out of eBay's live history window.
- Discover likely relistings using server-side matching rules, including configurable catalogue/record identifier matching.
- Explore purchases, captured market-price history, matched sales, and price charts.
- Ask an AI analytics assistant questions about stored data, with voice input in the web and macOS clients.
- Trigger discovery of matching live auctions and add them to the eBay watchlist, with streamed progress and limits on additions. This is an explicit eBay write action; the integration is no longer entirely read-only.

Feature availability can differ between clients. Business rules, derived values, and matching preferences are shared through the server; clients handle presentation and filtering of complete server results.

## Technology and data storage

| Area | Technology |
| --- | --- |
| Web app and backend API | Next.js 15, React 19, TypeScript |
| Native macOS client | Swift 6 / SwiftUI, macOS 15+, XcodeGen project |
| Persistent storage | PostgreSQL through Prisma 7 |
| Default database target | Hosted Neon PostgreSQL (`NEON_DATABASE_URL`) |
| Alternative database target | Local PostgreSQL (`DATABASE_URL`) |
| Analytics assistant | Anthropic SDK, configured with `claude-haiku-4-5` |
| Portable runtime | Node 22, Docker, Next.js standalone output |

`GOGGLER_DB_TARGET` selects `neon` (the default when unset) or `local`. The backend chooses the Neon HTTP/WebSocket adapter for Neon hosts and the PostgreSQL TCP adapter otherwise. Persistence integration tests use a separate test database.

The database stores won items, lost items, sanitized import-run metadata, captured market-price records (including soft-deletion markers), and per-user matching preferences. See [the Prisma schema](prisma/schema.prisma) and [database selection](src/persistence/prisma.ts).

**eBay OAuth credentials are never persisted.** Access tokens, refresh tokens, and pending OAuth state remain scoped to in-memory server sessions. Application sessions are also in memory, with an eight-hour default lifetime; restarting the backend requires signing in and reconnecting to eBay. Browser session cookies are HttpOnly, SameSite=Lax, and secure by default. Mutating routes use CSRF protection, and OAuth state is signed and single-use.

Secrets and configuration belong in an untracked environment file; see [.env.example](.env.example). Never commit secrets or bake environment files into Docker images.

## Private access and authentication

Remote access is restricted, and eBay authentication uses a separately configured public callback. Machine-specific addresses, ports, routing commands, and Developer Portal setup are maintained in the local-only `ebay.oauth.readme` runbook.

That file is excluded from Git and the Docker build context. It is maintained manually alongside configuration changes and must be transferred securely when setting up another machine; cloning the repository will not provide it. Keep credentials in the untracked environment configuration, not in the runbook.

## Running and deployment

For development, use Node 22, install dependencies with `npm ci`, configure an untracked `.env.local` using `.env.example`, generate the Prisma client with `npm run prisma:generate`, and run `npm run dev`. Production eBay authentication requires the configured public HTTPS callback; localhost alone cannot complete the production login flow. Database provisioning and migrations are separate setup steps.

The documented day-to-day deployment uses a machine-local macOS LaunchAgent (`com.goggler.server`) to start and supervise the production standalone server at login. It loads environment data using Node's `--env-file` option. Static assets must be copied into the standalone output after rebuilding. The LaunchAgent itself is not tracked in this repository.

Docker is the on-demand portable alternative:

```sh
docker build -t goggler .
docker run --rm --name goggler -p 3000:3000 --env-file /path/to/goggler.env goggler
```

The image runs as a non-root user and receives configuration at startup. Remote access uses the same Tailscale split described above. [GitHub Actions](.github/workflows/docker-publish.yml) publishes `alehad/goggler:<tag>` and `alehad/goggler:latest` only when a `v*` tag is pushed. Ordinary merges do not publish an image. Deployment is an explicit step.

## Development and verification

[AGENTS.md](AGENTS.md) is the authoritative repository workflow. Use short-lived `codex/` branches and pull requests into `main`, including for documentation changes. Behavior changes require OpenSpec planning and user design review before implementation. Do not commit directly to `main`, except for explicitly requested end-of-session notes.

Relevant checks include:

```sh
npm run build
npm run test:unit
npm run test:persistence
npm run openspec:validate
```

Persistence tests require a configured, separate PostgreSQL test database. Persistence changes must include deterministic checks that OAuth credential material is absent from both the persistent schema and runtime writes. The macOS project has its own Xcode build and tests under `macos/Goggler/`.

Known housekeeping: `npm run lint` still invokes deprecated `next lint` and needs migration to the ESLint CLI. OpenSpec change records live under `openspec/changes/`; accepted specifications have not yet been consolidated into `openspec/specs/`. Some historical task checklists and [session notes](docs/session-notes.md) are stale and should be checked against current code.

The autonomous shipping lifecycle in AGENTS.md is explicitly scoped to Claude Code. For Codex, the general workflow requires user confirmation before merging a PR. Publishing a new Docker version also requires user approval.

The original dependency-free UI prototype remains in `prototype/` as a historical design reference; the implemented web application is under `app/`.
