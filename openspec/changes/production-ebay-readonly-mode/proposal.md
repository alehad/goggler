# Change: Production eBay read-only mode

## Why

Sandbox OAuth and live history reads are working, but real watchlist and buying-history behavior can only be validated against the user's real eBay account. The next step should enable production eBay read-only retrieval while keeping write actions and persistent token storage out of scope.

## What Changes

- Add explicit production eBay OAuth credential configuration separate from Sandbox credentials.
- Keep Sandbox as the default local environment.
- Require explicit Sandbox credentials for Sandbox mode.
- Require production-specific client ID, client secret, redirect/RuName, and scopes when `EBAY_ENVIRONMENT=production`.
- Preserve the existing session-scoped token behavior and live `GetMyeBayBuying` read path.
- Document the local production read-only setup and test flow.

## Out Of Scope

- Adding items to the user's eBay watchlist.
- Persisting eBay access or refresh tokens at rest.
- Calling production eBay from automated tests.
- Implementing relisting search or matching beyond the current exact-title feed hints.

## Success Criteria

- Production mode cannot accidentally reuse Sandbox credential variables.
- Sandbox mode uses explicit Sandbox credential variables.
- `EBAY_ENVIRONMENT=production` selects production OAuth and Trading API endpoints.
- The Account tab reports production config readiness without exposing secrets.
- The user can configure production credentials locally, connect a real eBay account, and fetch read-only watchlist/history data through the existing live history route.
