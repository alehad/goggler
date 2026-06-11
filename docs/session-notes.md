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

## Current Status As Of 2026-06-11

- `main` is clean and synced with `origin/main`.
- Latest merged PR: #35, `Show dates on won items`.
- Real production eBay read-only testing is working through the secure ngrok tunnel.
- PostgreSQL 17.10 is installed locally through Homebrew and runs as the `postgresql@17` service.
- Local databases:
  - `goggler_prod`: durable won-item history for the local production/live app.
  - `goggler_test`: isolated persistence integration-test database.
- Successful live eBay refreshes now upsert won and lost items into `goggler_prod` and return the persisted supersets to the app.
- The first production import on 2026-06-10 stored 13 won items for `local-saja`, spanning purchases from 2026-03-29 through 2026-05-03.
- The first production lost-item import on 2026-06-11 stored 4 lost items for `local-saja`, spanning listings from 2026-05-24 through 2026-05-31.
- Current local durable production data: 13 won items and 4 lost items.
- Watchlist items and relisting candidates remain transient.
- eBay OAuth tokens, authorization codes, credential material, and raw upstream payloads must never be persisted in any database or durable store.
- The local secure tunnel command is:

```bash
ngrok http 3000 --traffic-policy-file ngrok/oauth.yml
```

- The reserved ngrok URL is still:

```text
https://unrigged-fifth-nastily.ngrok-free.dev
```

- The ngrok OAuth reset URL is:

```text
https://unrigged-fifth-nastily.ngrok-free.dev/ngrok/logout?auth_id=goggler-dev
```

- Production/live local app startup command:

```bash
EBAY_ENVIRONMENT=production GOGGLER_EBAY_HISTORY_SOURCE=live npm run dev
```

- eBay production read-only mode retrieves live watchlist, lost, and won buying-history rows from the authenticated account.
- eBay token values remain session-scoped only and are not persisted at rest.
- The Home feed data model now keeps two distinct lists:
  - eBay-sourced rows: current watchlist, won items, and lost/not-won history.
  - Relisting candidate rows: live search results that may be worth adding to the watchlist.
- Home live search searches active eBay listings, not only loaded local rows.
- Relisting discovery searches active eBay listings from unresolved lost-item catalogue IDs and filters by trusted record categories where available.
- Relisting view has an auction/buy-now/both filter visible only when the Relistings filter is active.
- Purchases tab has the local won-item paid-price chart restored. It uses won-item data only and no longer switches into Marketplace Insights mode on item selection.
- Marketplace Insights / 90-day sold-history code remains present behind its API route, but eBay access to `buy.marketplace.insights` is not yet available, so it is not the active Purchases experience.
- Lost/never-won rows now distinguish:
  - `max bid: <amount>` from `LostList.Item.BiddingDetails.MaxBid`, when eBay returns it.
  - `sold for: <amount>` from `LostList.Item.SellingStatus.CurrentPrice`.
  - Returned currency is preserved. USD displays as `$`; other dollar currencies should keep disambiguating prefixes such as `CA$` or `A$`.
- Won rows on Home and Purchases show a compact absolute `won: <date>` value next to condition and seller.

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
- eBay OAuth connect routes have been validated end to end against a real eBay Sandbox developer app through ngrok.
- eBay OAuth state signing requires `GOGGLER_AUTH_SECRET` with at least 32 characters.
- State-changing POST routes use same-origin CSRF checks.
- Local development through HTTPS tunnels is supported for OAuth testing. Forwarded `x-forwarded-host` / `x-forwarded-proto` headers are used to validate tunneled origins and redirect callbacks back to the public tunnel origin.
- The ngrok tunnel must be protected with the checked-in OAuth Traffic Policy for production eBay testing. Use `ngrok/oauth.yml` by default. `ngrok/oauth-callback-fallback.yml` exists only if full-gate callback preservation fails.
- Every implementation step must be preceded by an OpenSpec planning step. Planning and implementation may happen on the same feature branch, but the OpenSpec proposal/design/tasks/spec deltas come first.
- Local PostgreSQL is the first persistence target. Moving the item-history store to a hosted PostgreSQL provider such as Neon may be considered later.
- Durable storage currently applies only to normalized won/lost item records and sanitized import-run metadata.
- Won and lost items use separate tables because lost items have outcome-specific maximum-bid and sold-price fields.
- Persisted lost items are the durable source for lost-history classification and relisting discovery. Relisting candidates themselves are never persisted.

## Merged OpenSpec Changes

- `connect-ebay-account`: plans local user-owned eBay OAuth connection, session-scoped eBay token handling, and buying-history import through eBay Trading API.
- `testing-ci-foundation`: plans layered test coverage, auth-first verification, GitHub Actions checks, secret-safe CI behavior, mocked eBay provider responses, and optional advisory AI review.
- `ebay-inspired-responsive-ux`: plans a marketplace-oriented app shell with eBay-familiar buyer destinations, compact listing rows, account/preferences grouping, and a bottom-docked navigation model suitable for a future iPhone app.
- `ebay-buying-history-foundation`: plans and implements the first fixture-tested Trading API `GetMyeBayBuying` request/client boundary plus normalized lost/won buying-history fixture data.
- `fixture-history-ui`: plans and implements development-only fixture history mode after real local sign-in and session-scoped eBay connection.
- `home-relisting-watchlist-ux`: plans and implements the first watchlist-first Home feed using fixture watchlist data, relisting candidates, filters, and local-only add-to-watchlist affordance.
- `secure-ngrok-oauth-gate`: adds checked-in ngrok OAuth Traffic Policy files and documents secure local production eBay testing.
- `restore-purchases-paid-price-chart`: restores the Purchases tab paid-price chart for won items without invoking Marketplace Insights.
- `lost-bid-price-currency-detail`: separates max bid from final/sold price for lost-list rows and preserves/display currencies correctly.
- `getorders-purchases-supplement`: supplements `GetMyeBayBuying` won items with buyer `GetOrders` results from an older non-overlapping time window.
- `seller-profile-links`: links seller names on won and lost item rows to their eBay seller profiles.
- `persist-won-items`: adds local PostgreSQL/Prisma persistence for normalized won items and sanitized import-run metadata, with deterministic checks preventing OAuth credential persistence.
- `persist-lost-items`: adds separate PostgreSQL persistence for normalized lost items, keeps max bid separate from sold price, and uses durable lost history for relisting discovery.
- `show-won-date`: shows compact `won: <date>` metadata beside condition and seller on Home and Purchases won-item rows.

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
- eBay Sandbox OAuth was validated manually on 2026-05-09 using a Sandbox buyer test user and ngrok HTTPS callback.
- ngrok was installed locally with Homebrew and used to expose `localhost:3000` as a temporary HTTPS origin.
- eBay Sandbox app details configured locally:
  - Application title: `Goggler`
  - Sandbox RuName / redirect URI: `Alex_Hadzic-AlexHadz-Goggle-vdrxokh`
  - Accepted/declined redirect URL used for this session: `https://unrigged-fifth-nastily.ngrok-free.dev/api/auth/ebay/callback`
  - OAuth scope used for initial connect validation: `https://api.ebay.com/oauth/api_scope`
- PR #7 is merged to `main`; it stabilizes local-dev OAuth via ngrok by preserving the process-local session store across Next.js dev route reloads, supporting forwarded HTTPS origins for CSRF validation, and redirecting callbacks to the public tunnel origin.
- UX update PR #6 is merged to `main`.
- The app shell now uses a bottom-docked primary navigation model across desktop and mobile, with destinations for Home, Watching, Purchases, and My goggler.
- The sticky top header now carries the goggler brand, search, eBay setup status, filters, and local user control.
- Candidate relisting rows have been refined toward compact marketplace-style listing rows with image, title, seller/condition, lost bid/current bid, time left, confidence, and quick review actions.
- `.env.example` exists with expected local settings.
- Current verification before merge of PR #7:
  - `npm run test:unit` passed with 42 tests.
  - `npm run build` passed.
  - Manual eBay Sandbox OAuth flow through ngrok passed.
- PR #9 is merged to `main`; it added the eBay buying-history foundation:
  - `src/ebay/trading-client.ts` builds `GetMyeBayBuying` Trading API XML requests for `LostList` and `WonList`.
  - Trading API calls use OAuth token material only in the `X-EBAY-API-IAF-TOKEN` header, not in XML body.
  - Trading API endpoint config now supports Sandbox and production.
  - Basic XML parsing normalizes representative eBay buying-history responses into internal item records.
  - Fixture buying-history data includes 10 lost bid items and 7 won items, with 4 won items modeled as relistings of earlier lost bids.
- PR #10 is merged to `main`; it added fixture-backed buying history UI:
  - `GOGGLER_EBAY_HISTORY_SOURCE=fixture | live` controls the history source.
  - Fixture mode defaults outside production and is blocked in production.
  - `/api/ebay/buying-history` requires local sign-in plus an active session-scoped eBay connection before returning fixture history.
  - Watching renders lost bids with filters for all, never won, and eventually won.
  - Purchases renders won history from fixture data.
- PR #11 is merged to `main`; it added the watchlist-first Home feed:
  - Fixture data now includes 6 eBay watchlist items in explicit watchlist order.
  - 2 watchlist items are also tagged as relistings of previous non-won items.
  - 2 additional relisting candidates are not currently on the watchlist and show a local-only `Add` affordance.
  - Home now fetches the fixture history/feed after connection and shows filters for All, Needs action, On watchlist, Relistings, Never won, and Resolved.
  - Home ordering is: current eBay watchlist items first, then relisting candidates not on watchlist, then unresolved lost bids, then resolved/eventually-won lost bids.
- Current verification before merge of PR #11:
  - `npm run test:unit` passed with 74 tests.
  - `./node_modules/.bin/tsc --noEmit` passed.
  - Copilot advisory security review found no security issues.
  - Manual ngrok OAuth and fixture-history UI inspection passed.
- PR #29 is merged to `main`; it secured the ngrok tunnel:
  - `ngrok/oauth.yml` requires Google OAuth at the ngrok edge before traffic reaches the local app.
  - `ngrok/oauth-callback-fallback.yml` protects app UI/API routes while allowing only `/api/auth/ebay/callback` through if full-gate callback preservation fails.
  - The fallback is acceptable only for local development because the callback route still requires signed state, expiry, session binding when available, replay protection, and server-side token exchange.
  - Manual production eBay OAuth through the full ngrok OAuth gate passed after clearing stale ngrok state once.
- PR #30 is merged to `main`; it corrected lost-list price display:
  - Live Trading API parser now reads `BiddingDetails.MaxBid` for `LostList` rows.
  - `SellingStatus.CurrentPrice` is treated as sold/current listing price, not the user's bid.
  - Home and Watching render `max bid: <amount>` and `sold for: <amount>`.
  - Currency codes returned by eBay are preserved in the UI.
  - USD displays as `$` under the app formatter.
  - Copilot flagged a latent dynamic-regex risk in `parseMoney`; it was fixed by escaping tag names before regex construction.
- PR #31 is merged to `main`; it supplements won-item history with Trading API `GetOrders` results from a non-overlapping older window. Production testing did not return additional rows, confirming the practical eBay lookback limitation remains.
- PR #32 is merged to `main`; seller names on won and lost rows now link to their eBay profile pages.
- PR #33 is merged to `main`; it added durable won-item persistence:
  - Prisma and PostgreSQL configuration, schema, and initial migration are checked in.
  - Won items are idempotently upserted by owning user, venue, and eBay item ID.
  - Previously stored won items remain available when they fall outside later eBay live-history windows.
  - Later responses do not erase useful stored optional values when eBay omits them.
  - Import-run metadata stores only sanitized status and counts.
  - `AGENTS.md` permanently prohibits persistence of eBay OAuth credential material.
  - Persistence integration tests prove retention, idempotency, user isolation, optional-field preservation, and absence of credential/raw-payload fields.
  - Verification passed: 148 unit tests, 4 persistence integration tests, OpenSpec validation, production build, `git diff --check`, and Copilot advisory security review.
  - `npm audit` reports three moderate findings confined to Prisma's development CLI dependency chain; no production runtime exposure was identified.
- PR #34 is merged to `main`; it added durable lost-item persistence:
  - Lost items are stored separately from won items using user-owned idempotent upserts.
  - The user's maximum bid and the final sold price are stored as separate amount/currency pairs.
  - Older persisted lost items remain eligible for never-won/eventually-won classification and live relisting discovery after they age out of eBay's live response.
  - Watchlist items and relisting candidates remain transient and are not inserted into lost-item storage.
  - Production verification imported 4 real lost items for `local-saja`.
  - Verification passed: 149 unit tests, 7 persistence integration tests, OpenSpec validation, TypeScript checks, production build, database inspection, and Copilot advisory security review.
- PR #35 is merged to `main`; it added won-date metadata:
  - Home won rows and Purchases rows show `won: <date>` alongside condition and seller.
  - Dates use a safe compact absolute formatter and are omitted when missing or invalid.
  - Non-won rows and active-listing relative dates remain unchanged.
  - Verification passed: 152 unit tests, TypeScript checks, OpenSpec validation, production build, and production eBay refresh.

## Local Testing Notes

To test the app shell and local sign-in:

1. Run `npm run dev`.
2. Open `http://localhost:3000`.
3. Go to Account.
4. Click Sign in.
5. Confirm the top bar and Account tab show `Saja`.

To test eBay Sandbox OAuth locally:

1. Run `npm run dev`.
2. In another terminal, run `ngrok http 3000 --traffic-policy-file ngrok/oauth.yml`.
3. Confirm the active ngrok HTTPS URL matches the accepted/declined URL configured in the eBay Sandbox RuName. If ngrok gives a new temporary URL, update eBay Developer portal before testing.
4. Open the ngrok HTTPS URL, not `localhost`, in the browser.
5. Sign into goggler locally as `Saja`.
6. Go to My goggler and click Connect eBay.
7. Sign into the eBay Sandbox buyer test user and consent.
8. Confirm the app returns to the ngrok URL with `?account=ebay_connected` and the eBay status shows connected for the current session.

To test the fixture history and Home feed locally:

1. Use the ngrok HTTPS URL for the full flow, because eBay OAuth redirects require the registered HTTPS callback.
2. Sign into goggler locally as `Saja`.
3. Connect eBay through Sandbox.
4. Open Home.
5. Confirm the top rows are the 6 modeled eBay watchlist items in watchlist order.
6. Confirm 2 watchlist rows are tagged as relisting candidates.
7. Use the Home filters:
   - `Needs action` shows relisting candidates not on the watchlist.
   - `On watchlist` shows current eBay watchlist items.
   - `Relistings` shows both watched and not-watched relisting candidates.
   - `Never won` and `Resolved` show the corresponding lost-bid states.
8. Open Watching and Purchases to inspect lost and won history fixture views.

If the app shows a missing `.next/server` chunk error or loses styling after running `npm run build` while the dev server is active, stop the dev server, delete `.next`, and restart `npm run dev`. The generated `.next` output is shared by dev and production build modes.

To test against real eBay production locally:

1. Ensure the PostgreSQL service is running:

```bash
brew services start postgresql@17
```

2. Ensure `.env.local` contains production eBay credentials and the local production database:
   - `DATABASE_URL=postgresql://<local-role>@localhost:5432/goggler_prod`
   - `EBAY_ENVIRONMENT=production`
   - `EBAY_PRODUCTION_CLIENT_ID`
   - `EBAY_PRODUCTION_CLIENT_SECRET`
   - `EBAY_PRODUCTION_REDIRECT_URI`
   - `EBAY_PRODUCTION_OAUTH_SCOPES`
   - `EBAY_MARKETPLACE_ID=EBAY_GB`
   - `EBAY_TRADING_SITE_ID=3`
   - `GOGGLER_EBAY_HISTORY_SOURCE=live`
3. Start the app:

```bash
EBAY_ENVIRONMENT=production GOGGLER_EBAY_HISTORY_SOURCE=live npm run dev
```

4. Start the secure tunnel:

```bash
ngrok http 3000 --traffic-policy-file ngrok/oauth.yml
```

5. Open `https://unrigged-fifth-nastily.ngrok-free.dev`.
6. If ngrok reports an invalid OAuth `state`, reset ngrok auth with:

```text
https://unrigged-fifth-nastily.ngrok-free.dev/ngrok/logout?auth_id=goggler-dev
```

7. Complete ngrok Google OAuth if prompted.
8. Connect to production eBay from goggler and confirm Home, Watching, and Purchases load live read-only data.
9. A successful history refresh should import normalized won and lost items into `goggler_prod`.
10. Confirm won rows on Home and Purchases show `won: <date>` next to condition and seller.

To run persistence integration tests:

```bash
brew services start postgresql@17
npm run test:persistence
```

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
- Fixture-backed Home feed led by modeled eBay watchlist rows, followed by relisting candidates and unresolved/resolved lost-bid history.
- Development-only fixture history source guarded behind local sign-in and active session-scoped eBay connection.
- Production/live Home feed with current watchlist, won history, lost history, relisting candidates, live eBay search, and relisting auction/buy-now filtering.
- Watching tab with max-bid and sold-for display for lost items when eBay returns both values.
- Purchases tab with won-item paid-price summary cards, price-over-time scatter plot, and compact won-date metadata.

The static prototype can be opened directly from `prototype/index.html` or served locally from the `prototype/` folder.

## Cross-Machine Resume Notes

The Codex chat may or may not carry across machines, but the repository should be treated as the durable source of context.

When moving to another Mac:

1. Clone `https://github.com/alehad/goggler`.
2. Tell Codex the local repo path on that machine.
3. Ask Codex to inspect `AGENTS.md`, `openspec/project.md`, `docs/session-notes.md`, and current Git state before continuing.
4. Continue from `main` unless an active branch is intentionally in progress.

## Next Likely Steps

- Confirm the Purchases tab consistently renders the persisted won-item superset after items age beyond eBay's live-history window.
- Confirm Watching and relisting discovery consistently use the persisted lost-item superset after items age beyond eBay's live-history window.
- Decide whether to add a controlled backfill/import mechanism for older won items that eBay APIs no longer return.
- Decide whether a controlled backfill is possible for older lost items that eBay APIs no longer return.
- Consider whether additional approved won-item fields, such as shipping or tax-inclusive totals where available, should be normalized and persisted.
- Plan persistence-backed user actions such as `Confirm match` and `Dismiss` separately; do not expand persistence beyond reviewed OpenSpec changes.
- Investigate eBay APIs/scopes for adding items to the authenticated user's watchlist. The current preferred low-risk flow is still to open the item on eBay and let the user add it there, unless a separate write-action OpenSpec change is reviewed.
- Decide what to do with Marketplace Insights / sold-history analytics. Access to `buy.marketplace.insights` is not currently approved, so the app should not depend on it for the Purchases tab.
- Consider moving the PostgreSQL item-history store to Neon or another hosted PostgreSQL provider once local behavior is mature and cross-machine access is needed.
- Consider a separate tooling branch to replace deprecated `next lint` with the ESLint CLI.

## eBay Developer Setup

Sandbox setup completed on 2026-05-09:

- eBay Developer application title: `Goggler`
- Sandbox App ID, Dev ID, and Cert ID were created. Do not paste or commit the App ID/Cert ID values.
- OAuth user consent was configured for Sandbox.
- Sandbox buyer test user was created and used for OAuth consent.
- Sandbox RuName / redirect URI: `Alex_Hadzic-AlexHadz-Goggle-vdrxokh`
- Accepted and declined URLs were configured to the temporary ngrok callback for this session.
- Environment variables are kept in `.env.local` and must never be committed.

Current local environment variables:

```bash
DATABASE_URL=postgresql://<local-role>@localhost:5432/goggler_prod
TEST_DATABASE_URL=postgresql://<local-role>@localhost:5432/goggler_test
GOGGLER_AUTH_SECRET=at-least-32-characters # already generated locally
EBAY_ENVIRONMENT=sandbox
EBAY_CLIENT_ID=<Sandbox App ID>
EBAY_CLIENT_SECRET=<Sandbox Cert ID>
EBAY_REDIRECT_URI=Alex_Hadzic-AlexHadz-Goggle-vdrxokh
EBAY_OAUTH_SCOPES=https://api.ebay.com/oauth/api_scope
EBAY_MARKETPLACE_ID=EBAY_GB
EBAY_TRADING_SITE_ID=3
GOGGLER_EBAY_HISTORY_SOURCE=fixture
```
