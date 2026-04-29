# Change: Connect eBay account

## Why

goggler needs a user-specific eBay connection before it can import bid history and identify auctions the user did not win. The connection must be based on eBay user consent rather than collecting the user's eBay password, and it must support both the legacy buying-history API and later active-listing discovery.

## What Changes

- Add an authenticated local app user flow as the owner of eBay account connections.
- Implement eBay OAuth authorization-code connection for a user's eBay UK account.
- Keep eBay OAuth token values session-scoped only, without persisting eBay tokens at rest.
- Require the user to reconnect eBay after each new goggler login or when the session-scoped eBay token expires.
- Use the connected account to call Trading API `GetMyeBayBuying` for won and not-won buying history.
- Normalize imported won and not-won auction records into internal domain structures.
- Show connection state, import state, and actionable errors in the account/dashboard UI.

## Out Of Scope

- Asking for or storing the user's eBay password.
- Persisting eBay access tokens or refresh tokens at rest.
- Placing bids, retracting bids, checkout, or order management.
- Public registration, password reset, or hosted multi-tenant account management.
- Full relisting search and candidate matching implementation.
- Production eBay approval workflows beyond documenting required app keys, RuName, scopes, and marketplace settings.

## Success Criteria

- A local app user can start eBay connection and complete eBay consent.
- The app can use the session-scoped eBay token for the current goggler login without storing eBay token values at rest.
- The app asks the user to reconnect eBay when no valid session-scoped eBay token is available.
- The user can run an initial buying-history import for eBay UK.
- Won and not-won auction rows are persisted with user ownership, source identifiers, prices, timestamps, and enough item metadata to support tracking and future matching.
- Connection and import failures are visible and recoverable without corrupting existing imported records.
