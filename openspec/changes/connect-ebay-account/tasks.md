# Tasks: Connect eBay account

## 1. Specification And API Validation

- [x] Create OpenSpec change for eBay account connection planning.
- [x] Validate current eBay auth and buying-history API direction.
- [ ] Confirm exact OAuth scopes and redirect/RuName settings from the target eBay developer account.
- [ ] Confirm Sandbox `GetMyeBayBuying` request headers, UK site id, and representative response fields.

## 2. Local User And Persistence Foundation

- [ ] Add Prisma and PostgreSQL configuration if not already present.
- [ ] Model `User`, `Session`, `ConnectedVenueAccount`, `ImportRun`, and imported auction records.
- [ ] Add environment variable template for database, session, and eBay settings.
- [ ] Add tests proving eBay token values are not persisted in database-backed models or browser-visible responses.

## 3. Local Authentication

- [ ] Create a minimal local sign-in/session flow.
- [ ] Add request helper for resolving the current user on server routes.
- [ ] Protect account and import routes from anonymous access.
- [ ] Add tests for session creation, lookup, expiry, and logout.

## 4. eBay OAuth Connection

- [ ] Implement eBay environment/config module.
- [ ] Implement signed OAuth state creation and validation.
- [ ] Add eBay consent start route.
- [ ] Add eBay OAuth callback route and token exchange.
- [ ] Store eBay token values only in server-side session state for the current goggler login.
- [ ] Persist only non-secret eBay connection metadata when available.
- [ ] Add disconnect route that clears session-scoped eBay token material.
- [ ] Add tests for start, callback, invalid state, exchange failure, and disconnect.

## 5. eBay Adapter And Session Authorization

- [ ] Add adapter helper that returns a valid session-scoped access token or marks reauth required.
- [ ] Handle expired session-scoped eBay access by asking the user to reconnect eBay.
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

- [ ] Replace mock eBay connection state with server-backed connection status.
- [ ] Add Connect eBay, Disconnect, and Import buying history actions.
- [ ] Show import progress/result and recoverable errors.
- [ ] Add a basic smoke test for connect-state rendering and import action availability.

## 8. Verification

- [ ] Run unit tests.
- [ ] Run database migration against a local development database.
- [ ] Run eBay Sandbox OAuth connect flow.
- [ ] Run Sandbox buying-history import with won and not-won fixtures.
- [ ] Document production setup checklist and remaining eBay approval requirements.
