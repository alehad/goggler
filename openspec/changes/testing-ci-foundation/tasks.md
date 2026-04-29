# Tasks: Testing CI foundation

## 1. Specification

- [x] Create OpenSpec change for testing and CI planning.
- [ ] Review auth-first coverage requirements before implementing auth.
- [ ] Decide the initial TypeScript test runner when auth implementation begins.
- [ ] Decide whether AI review should comment on PRs or write workflow summaries in its first version.

## 2. Test Tooling

- [ ] Add package scripts for lint, typecheck, unit tests, integration tests, and build.
- [ ] Add a unit/route test runner.
- [ ] Add test utilities for route handlers and mocked sessions.
- [ ] Add database test setup once Prisma/PostgreSQL is introduced.
- [ ] Add eBay HTTP/XML fixtures for OAuth and `GetMyeBayBuying`.
- [ ] Add Playwright only when browser smoke tests have real routes to exercise.

## 3. Auth Coverage

- [ ] Test local session creation, lookup, expiry, and logout.
- [ ] Test OAuth state signing, validation, expiry, replay rejection, and tamper rejection.
- [ ] Test eBay authorization URL construction.
- [ ] Test anonymous users cannot start eBay OAuth.
- [ ] Test valid eBay callback stores token values only in server-side session state.
- [ ] Test invalid eBay callback stores no token material.
- [ ] Test disconnect clears session-scoped eBay token material.
- [ ] Test import routes require both local session auth and active eBay session auth.
- [ ] Test eBay token values are not persisted in database-backed models or browser-visible responses.

## 4. Adapter And Import Coverage

- [ ] Test eBay OAuth token exchange with mocked provider responses.
- [ ] Test Trading API `GetMyeBayBuying` headers and XML request body.
- [ ] Test won-list and lost-list XML normalization.
- [ ] Test provider error handling and malformed response handling.
- [ ] Test idempotent import updates existing records instead of duplicating them.
- [ ] Test imported auction records are owned by the current local user.

## 5. GitHub Actions

- [ ] Add pull request workflow for install, lint, typecheck, unit tests, and build.
- [ ] Add PostgreSQL service and integration-test job when persistence exists.
- [ ] Ensure default CI uses mocked eBay responses and no production eBay credentials.
- [ ] Cache package-manager dependencies where supported.
- [ ] Upload useful test artifacts only when they do not contain secrets.

## 6. Advisory AI Review

- [ ] Add non-blocking AI review workflow after deterministic CI exists.
- [ ] Configure review model through `AI_REVIEW_MODEL` or equivalent.
- [ ] Read API credentials from GitHub Actions secrets.
- [ ] Feed the workflow PR diff, relevant OpenSpec files, and deterministic check summaries.
- [ ] Keep model feedback advisory until a later OpenSpec change makes any part blocking.

## 7. Verification

- [ ] Run all local tests.
- [ ] Open a test PR and confirm GitHub Actions run successfully.
- [ ] Confirm no CI logs expose session tokens, eBay tokens, OAuth codes, or provider secrets.
- [ ] Confirm AI review can be disabled without affecting deterministic checks.
