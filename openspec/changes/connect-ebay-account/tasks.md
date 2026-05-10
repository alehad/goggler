# Tasks: Connect eBay account

## 1. Specification And API Validation

- [x] Create OpenSpec change for eBay account connection planning.
- [x] Validate current eBay auth and buying-history API direction.
- [ ] Confirm exact OAuth scopes and redirect/RuName settings from the target eBay developer account.
- [ ] Confirm Sandbox `GetMyeBayBuying` request headers, UK site id, and representative response fields.

## 2. Local User And Persistence Foundation

- [ ] Add Prisma and PostgreSQL configuration if not already present.
- [ ] Model `User`, `Session`, `ConnectedVenueAccount`, `ImportRun`, and imported auction records.
- [x] Add environment variable template for database, session, and eBay settings.
- [ ] Add tests proving eBay token values are not persisted in database-backed models or browser-visible responses.

## 3. Local Authentication

- [x] Create a minimal local sign-in/session flow.
- [x] Add request helper for resolving the current user on server routes.
- [x] Protect account and import routes from anonymous access.
- [x] Keep the process-local development session store stable across Next.js dev route reloads.
- [x] Support same-origin CSRF validation when local development is reached through an HTTPS tunnel.
- [x] Redirect OAuth callbacks back to the public tunnel origin when local development is proxied.
- [x] Add tests for session creation, lookup, expiry, and logout.

## 4. eBay OAuth Connection

- [x] Implement eBay environment/config module.
- [x] Implement signed OAuth state creation and validation.
- [x] Add eBay consent start route.
- [x] Prewarm the eBay consent start route so the first Connect click navigates to eBay in local development.
- [x] Add eBay OAuth callback route and token exchange.
- [x] Store eBay token values only in server-side session state for the current goggler login.
- [ ] Persist only non-secret eBay connection metadata when available.
- [x] Add disconnect route that clears session-scoped eBay token material.
- [x] Add tests for start, callback, invalid state, exchange failure, and disconnect.

## 5. eBay Adapter And Session Authorization

- [x] Add adapter helper that returns a valid session-scoped access token or marks reauth required.
- [x] Handle expired session-scoped eBay access by asking the user to reconnect eBay.
- [ ] Implement Trading API XML client using OAuth `X-EBAY-API-IAF-TOKEN`.
- [ ] Add response validation and normalized adapter errors.
- [ ] Add tests with mocked eBay responses.

## 6. Buying History Import

- [ ] Implement `GetMyeBayBuying` request builder for `WonList` and `LostList`.
- [ ] Page through won and lost buying history with a safety limit.
- [ ] Normalize eBay items into internal auction history records.
- [ ] Upsert imported records idempotently by user and eBay item identity.
- [ ] Store import run counts, status, and last error.
- [ ] Add tests for pagination, deduplication, partial failures, and malformed responses.

## 7. Account UI

- [x] Replace mock eBay connection state with server-backed connection status.
- [x] Add Connect eBay and Disconnect actions.
- [ ] Add Import buying history action.
- [ ] Show import progress/result and recoverable errors.
- [ ] Add a basic smoke test for connect-state rendering and import action availability.

## 8. Verification

- [x] Run unit tests.
- [ ] Run database migration against a local development database.
- [ ] Run eBay Sandbox OAuth connect flow.
- [ ] Run Sandbox buying-history import with won and not-won fixtures.
- [ ] Document production setup checklist and remaining eBay approval requirements.
