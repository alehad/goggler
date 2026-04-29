# Design: Connect eBay account

## Overview

The first real backend milestone should establish three foundations together: local session ownership, session-scoped eBay OAuth connection, and a minimal buying-history import pipeline. This keeps user ownership and imported auction ownership aligned while avoiding persistent custody of eBay tokens.

eBay's current documentation points to a hybrid integration:

- OAuth authorization-code flow for user consent and user access tokens.
- OAuth user tokens can authorize Trading API calls by sending `X-EBAY-API-IAF-TOKEN`.
- Trading API `GetMyeBayBuying` returns authenticated My eBay buying data, including bid, won, and lost lists.
- Buy Offer API can retrieve bidding details for a specific item, but it is limited-release and does not replace full buying-history import.

## Architecture

### Local Authentication

Use a simple local authentication model first, with an `app_user` owning all downstream records. If Auth.js is introduced during implementation, keep provider-specific session details outside the domain model.

Minimum tables:

- `User`: display name, optional email, created/updated timestamps.
- `Session`: opaque session token hash, user id, expiry.

The implementation may start with a single seeded local user if that is faster, but request handlers should still resolve a current `User` and never write global eBay data.

### Session-Scoped eBay Authorization

Represent eBay authorization as part of the user's active goggler session. The app should persist imported auction data and import metadata, but it must not persist eBay access tokens or refresh tokens at rest.

Minimum persistent connection metadata:

- `id`, `userId`, `venue` set to `EBAY_UK`.
- eBay account identifier or username when available.
- last eBay authorization time.
- last successful import time and last connection error.
- last known connection outcome, such as `connected_this_session`, `reauth_required`, `error`, or `disconnected`.

Session-only token handling:

- Store eBay access token values only in server-side session state for the current goggler login.
- Do not write eBay access tokens or refresh tokens to the database, logs, client cookies, local storage, or browser-visible responses.
- Prefer not requesting offline access or refresh-token capability unless later product requirements need background imports.
- If eBay returns a refresh token anyway, use it only in memory for the active server session or discard it.
- When the goggler session ends, expires, or is cleared, the eBay authorization ends too.
- If the eBay access token expires during an active session and no session-scoped refresh is available, mark the session as requiring eBay reauthorization.

### OAuth Flow

Add server routes for:

- `GET /api/auth/ebay/start`: requires local session, creates signed state, redirects to eBay consent.
- `GET /api/auth/ebay/callback`: validates state, exchanges authorization code for tokens, stores eBay token values only in server-side session state, updates persistent non-secret connection metadata, and redirects back to account UI.
- `POST /api/auth/ebay/disconnect`: clears session-scoped eBay token material and marks the active session disconnected.

Configuration:

- `EBAY_ENVIRONMENT`: `sandbox` or `production`.
- `EBAY_CLIENT_ID`.
- `EBAY_CLIENT_SECRET`.
- `EBAY_REDIRECT_URI` or RuName-derived redirect configuration.
- `EBAY_MARKETPLACE_ID=EBAY_GB`.
- `EBAY_TRADING_SITE_ID=3` for UK Trading API calls.

Scopes should be configured from the eBay developer portal and kept minimal. Trading APIs themselves do not use OAuth scopes, but the authorization-code user token is still required. If Browse or Offer calls are added in this change, request only the required Buy scopes. Avoid scopes or consent options that grant long-lived offline access unless a future change explicitly adds background imports.

### eBay Adapter

The adapter boundary should expose app-level operations:

```ts
type EbayAdapter = {
  getConnectionStatus(userId: string): Promise<ConnectionStatus>;
  requireSessionAccessToken(userId: string): Promise<string>;
  importBuyingHistory(userId: string, options?: ImportOptions): Promise<BuyingHistoryImportResult>;
};
```

Internally, split this into:

- OAuth client: builds consent URLs, exchanges codes, and manages session-scoped token availability.
- Trading API client: posts XML requests to `GetMyeBayBuying`.
- Normalizer: maps Trading API item payloads to internal auction records.
- Import service: pages through won/lost lists, deduplicates by venue item id and list type, writes an import run summary.

### Buying History Import

Start with `WonList` and `LostList`; optionally include `BidList` as current active bid context once won/lost import is stable.

Import behavior:

- Fetch pages until no more pages are available or a configured safety page limit is reached.
- Persist each source item idempotently by user, venue, source item id, and history bucket.
- Preserve raw source snapshots in a JSON column for debugging, but keep UI/domain code on normalized fields.
- Track import runs with status, started/finished timestamps, counts, and error message.
- Mark not-won auctions as eligible for tracking, but do not auto-track them without a later explicit product decision.

### UI Surface

The Account tab should move from mock state to real connection state:

- not connected: Connect eBay button.
- connecting/callback pending: disabled state.
- connected for this session: account identifier when available, session/import health, Disconnect, Import buying history.
- reauth required: reconnect prompt explaining that eBay is connected only for the current goggler session.
- import error: last error and retry.

Dashboard and tracking tabs can continue using mock data until the import persistence layer is ready, but the account UI should not pretend the import has completed.

## Risks And Decisions

- `GetMyeBayBuying` is a Trading API XML call. We should wrap XML parsing and response validation carefully instead of leaking XML shapes through the app.
- eBay OAuth setup depends on developer portal configuration, especially app keys and redirect/RuName settings. Sandbox support should be the first verification target.
- Buy Offer API is limited-release, so it should not be required for the first buying-history import.
- The user's request says "user credentials"; implementation should interpret that as OAuth user consent, not password capture.
- Session-scoped eBay tokens mean imports cannot run unattended in the background after the user logs out. That is acceptable for the personal-first version and can be revisited only through a future OpenSpec change.
