# Session Notes

These notes capture working context that should survive moving between machines or resuming after a long break. They are not formal requirements; formal behavior belongs in OpenSpec.

## Current Project

- Project name: `goggler`
- GitHub repository: `https://github.com/alehad/goggler`
- Primary local path on current machine: `/Users/ahadzic/GitHub/goggler`
- Development workflow: short-lived `codex/` branches, PR review, merge to `main` after user approval, then delete local and remote feature branches.

## Product Direction

goggler is a personal-first eBay UK auction tracker. It helps the user find auction items that reappear after the user bid on them but did not win.

Initial scope:

- Single-user intent, but with a real app `User` concept from day one.
- eBay UK first.
- Import authenticated eBay buying history.
- Track not-won auction items.
- Search for likely exact relistings.
- Show candidates in an in-app dashboard.
- Preserve won-item data for later purchase analytics.

## Architecture Decisions So Far

- Use OpenSpec for spec-driven development.
- Keep marketplace-specific behavior behind a trading venue adapter layer.
- Start with eBay, but design the adapter boundary so other venues can be added later.
- Recommended app stack is TypeScript, Next.js, PostgreSQL, Prisma, and a simple job/worker approach.
- Initial matching should be deterministic and explainable before adding AI-assisted or image-based similarity.
- eBay account connection should use OAuth user consent, not eBay password capture.
- eBay OAuth token values must be session-scoped only. The app should not persist eBay access tokens or refresh tokens at rest.
- Users can be asked to authenticate with eBay again on each new goggler login, or when the session-scoped eBay token expires.
- Persistent eBay-related storage may keep non-secret connection/import metadata and imported auction records, but not token material.
- Buying-history import planning currently targets Trading API `GetMyeBayBuying` for won and lost My eBay buying lists.
- Tests and CI should be planned around auth first: local sessions, OAuth state handling, session-only token behavior, import authorization, and proof that eBay tokens are not persisted.
- GitHub Actions should start with deterministic checks: lint, typecheck, unit tests, integration tests when persistence exists, and production build.
- Advisory AI review should start locally, using VS Code GitHub Copilot review of uncommitted changes. Hosted AI review or GitHub Copilot PR review can be revisited later.
- Direct commits to `main` are only allowed for explicit end-of-session updates to `docs/session-notes.md`. All other code, dependency, configuration, OpenSpec, and documentation changes should use a `codex/` branch and PR.
- Local goggler auth is currently an in-memory seeded-user session model. It stores only a hash of the local session token server-side and uses an HttpOnly cookie in the browser.
- Local HTTP development cookies intentionally omit the `Secure` flag so `http://localhost:3000` sign-in works; HTTPS requests still get Secure cookies.
- eBay OAuth connect routes now exist, but have not yet been validated against a real eBay Sandbox developer app.
- eBay OAuth state signing requires `GOGGLER_AUTH_SECRET` with at least 32 characters.
- State-changing POST routes use same-origin CSRF checks.

## Merged OpenSpec Changes

- `connect-ebay-account`: plans local user-owned eBay OAuth connection, session-scoped eBay token handling, and buying-history import through eBay Trading API.
- `testing-ci-foundation`: plans layered test coverage, auth-first verification, GitHub Actions checks, secret-safe CI behavior, mocked eBay provider responses, and optional advisory AI review.
- `ebay-inspired-responsive-ux`: plans a marketplace-oriented app shell with eBay-familiar buyer destinations, compact listing rows, account/preferences grouping, and a bottom-docked navigation model suitable for a future iPhone app.

## Implemented So Far

- Local goggler sign-in/session foundation is merged to `main`.
- Account tab is wired to local sign-in/sign-out and real eBay session status.
- eBay OAuth backend slice is merged to `main` in PR #4.
- Implemented eBay routes:
  - `GET /api/auth/ebay/start`
  - `GET /api/auth/ebay/callback`
  - `GET /api/auth/ebay/session`
  - `POST /api/auth/ebay/disconnect`
- Implemented eBay config loading, signed OAuth state creation/validation, authorization-code token exchange, and session-scoped eBay token storage.
- eBay access/refresh token values are kept only in server-side session memory for the current goggler login and are not exposed through status responses.
- UX update PR #6 is merged to `main`.
- The app shell now uses a bottom-docked primary navigation model across desktop and mobile, with destinations for Home, Watching, Purchases, and My goggler.
- The sticky top header now carries the goggler brand, search, eBay setup status, filters, and local user control.
- Candidate relisting rows have been refined toward compact marketplace-style listing rows with image, title, seller/condition, lost bid/current bid, time left, confidence, and quick review actions.
- `.env.example` exists with expected local settings.
- Current verification before merge of PR #6:
  - `npm run test:unit` passed with 39 tests.
  - `npm run build` passed.
  - Local browser check passed for the bottom-docked UX direction.

## Local Testing Notes

To test the app shell and local sign-in:

1. Run `npm run dev`.
2. Open `http://localhost:3000`.
3. Go to Account.
4. Click Sign in.
5. Confirm the top bar and Account tab show `Saja`.

If the app shows a missing `.next/server` chunk error or loses styling after running `npm run build` while the dev server is active, stop the dev server, delete `.next`, and restart `npm run dev`. The generated `.next` output is shared by dev and production build modes.

`npm run lint` is currently stale because it still uses deprecated `next lint`, which prompts for ESLint migration under Next 15. `npm run build` currently performs the framework type/lint validation successfully.

## UI Direction

An initial UI foundation and the first marketplace-oriented responsive UX pass have been merged to `main`.

It includes:

- Next.js TypeScript scaffold files.
- A dependency-free static prototype under `prototype/`.
- App destinations for Home, Watching, Purchases, and My goggler.
- Bottom-docked primary navigation designed to map naturally to a future iPhone app.
- Sticky top search/header with brand, filters, eBay setup status, and local user access.
- Mock vinyl-record auction data.
- Candidate relisting rows with confidence, pricing context, matching signals, ending time, and review actions.

The static prototype can be opened directly from `prototype/index.html` or served locally from the `prototype/` folder.

## Cross-Machine Resume Notes

The Codex chat may or may not carry across machines, but the repository should be treated as the durable source of context.

When moving to another Mac:

1. Clone `https://github.com/alehad/goggler`.
2. Tell Codex the local repo path on that machine.
3. Ask Codex to inspect `AGENTS.md`, `openspec/project.md`, `docs/session-notes.md`, and current Git state before continuing.
4. Continue from `main` unless an active branch is intentionally in progress.

## Next Likely Steps

- Create the eBay Developer Sandbox app configuration and collect the Sandbox client id, client secret, RuName/redirect value, and allowed scopes.
- Create a local `.env.local` from `.env.example` with Sandbox values and a strong `GOGGLER_AUTH_SECRET`.
- Start `npm run dev`, sign into goggler locally, click Connect in the Account tab, and validate the full eBay Sandbox OAuth redirect/callback flow.
- Confirm the callback marks eBay as connected for the current goggler session.
- If real eBay Sandbox connection succeeds, update any OpenSpec tasks and session notes with exact Sandbox setup details.
- Only after OAuth connect works end to end, implement `GetMyeBayBuying` import as a separate follow-on change.
- Consider a separate tooling branch to replace deprecated `next lint` with the ESLint CLI.

## eBay Developer Setup Needed

To test against a real eBay account, the next Codex instance/user will need eBay Developer Program configuration:

- eBay application keys for Sandbox first, then Production later.
- OAuth user consent configured for the app.
- The correct eBay RuName / redirect URI value for the selected environment.
- Accept and reject URLs configured in the eBay developer portal.
- Minimal scopes confirmed for the OAuth user token.
- Environment variables kept in `.env.local` and never committed.

Likely local environment variables:

```bash
DATABASE_URL=
GOGGLER_AUTH_SECRET=at-least-32-characters
EBAY_ENVIRONMENT=sandbox
EBAY_CLIENT_ID=...
EBAY_CLIENT_SECRET=...
EBAY_REDIRECT_URI=...
EBAY_OAUTH_SCOPES=...
EBAY_MARKETPLACE_ID=EBAY_GB
EBAY_TRADING_SITE_ID=3
```
