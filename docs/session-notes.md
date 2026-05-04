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

## Merged OpenSpec Changes

- `connect-ebay-account`: plans local user-owned eBay OAuth connection, session-scoped eBay token handling, and buying-history import through eBay Trading API.
- `testing-ci-foundation`: plans layered test coverage, auth-first verification, GitHub Actions checks, secret-safe CI behavior, mocked eBay provider responses, and optional advisory AI review.

## UI Direction

An initial UI foundation has been merged to `main`.

It includes:

- Next.js TypeScript scaffold files.
- A dependency-free static prototype under `prototype/`.
- Tabs for Dashboard, Tracking, Won, and Account.
- Mock vinyl-record auction data.
- Candidate relisting cards with confidence, pricing context, matching signals, ending time, and review actions.

The static prototype can be opened directly from `prototype/index.html` or served locally from the `prototype/` folder.

## Cross-Machine Resume Notes

The Codex chat may or may not carry across machines, but the repository should be treated as the durable source of context.

When moving to another Mac:

1. Clone `https://github.com/alehad/goggler`.
2. Tell Codex the local repo path on that machine.
3. Ask Codex to inspect `AGENTS.md`, `openspec/project.md`, `docs/session-notes.md`, and current Git state before continuing.
4. Continue from `main` unless an active branch is intentionally in progress.

## Next Likely Steps

- Local goggler auth/session foundation is implemented on `main` in commit `f016d14`.
- The next implementation branch should likely be `codex/ebay-oauth-connect`.
- Implement eBay OAuth connection only first, before buying-history import.
- Add `GET /api/auth/ebay/start`, `GET /api/auth/ebay/callback`, and `POST /api/auth/ebay/disconnect`.
- Add eBay config handling for environment, client id, client secret, RuName/redirect value, marketplace id, and UK Trading API site id.
- Add signed OAuth state creation/validation with tests for valid, missing, expired, replayed, and tampered state.
- Exchange the eBay authorization code for a user access token, but keep eBay token values only in server-side session state for the current goggler login.
- Persist only non-secret eBay connection metadata, such as connection status, account identifier when available, last authorization time, and last connection error.
- Update the Account UI from mock state to real states: not connected, connecting, connected for this session, reauth required, disconnected, and error.
- After OAuth connect works end to end, implement `GetMyeBayBuying` import as a separate follow-on change.

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
EBAY_ENVIRONMENT=sandbox
EBAY_CLIENT_ID=...
EBAY_CLIENT_SECRET=...
EBAY_REDIRECT_URI=...
EBAY_MARKETPLACE_ID=EBAY_GB
EBAY_TRADING_SITE_ID=3
```
