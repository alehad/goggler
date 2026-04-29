# Design: Testing CI foundation

## Overview

Testing should follow the shape of the system rather than the folder tree. The highest-risk promises are user ownership, session-scoped eBay authorization, import idempotency, and no eBay token persistence. The first CI setup should make those promises hard to regress while staying small enough that every pull request gets quick feedback.

## Test Layers

### Unit Tests

Use unit tests for pure logic that does not need Next.js routing, a database, or network access.

Initial auth targets:

- Session token generation, hashing, expiry, and lookup helpers.
- OAuth state signing, validation, expiry, and tamper rejection.
- eBay authorization URL construction.
- OAuth callback parsing and provider error normalization.
- Guards or serializers that ensure token values are not returned to browser-visible responses.

### Route And API Tests

Route/API tests should exercise Next route handlers with mocked dependencies.

Initial auth targets:

- Anonymous users cannot start eBay OAuth.
- Signed-in users can start eBay OAuth and receive a redirect.
- Callback rejects missing, expired, reused, or invalid state.
- Callback stores eBay token values only in server-side session state.
- Disconnect clears session-scoped eBay token material.
- Import endpoints reject requests without both local session auth and active eBay session auth.

### Persistence Tests

Persistence tests should use an isolated database and migrate or push the test schema before each CI run.

Initial auth targets:

- Users, sessions, connected venue metadata, import runs, and imported auction records are user-owned.
- Persistent connected venue records contain only non-secret metadata.
- eBay access tokens, refresh tokens, authorization codes, and OAuth callback query strings are not written to persistent tables.
- Session expiry prevents later use of session-scoped eBay auth.

### Adapter Contract Tests

Adapter tests should mock external eBay calls by default. They should verify the boundary between the app and provider-specific data.

Initial auth and import targets:

- eBay OAuth token exchange request and response handling.
- Trading API `GetMyeBayBuying` request headers and XML body construction.
- Normalization of representative `WonList` and `LostList` XML responses.
- Recoverable errors for missing eBay session auth, invalid provider responses, and provider failures.

### Integration Tests

Integration tests should cover a complete server-side path with real app wiring and mocked eBay.

Initial flow:

1. Create or sign in as a local user.
2. Start eBay OAuth.
3. Simulate valid eBay callback.
4. Run a buying-history import with mocked eBay responses.
5. Assert imported records are user-owned.
6. Assert no eBay token values are persisted.

### End-To-End Smoke Tests

Browser smoke tests should be small until the app has real backend routes.

Initial UI targets:

- Account tab shows connect, connected-for-this-session, reauth-required, and import-error states.
- Import action is available only when local session and eBay session auth are active.
- User-facing errors are actionable and do not expose provider secrets.

## Tooling Direction

Use the smallest conventional TypeScript stack that fits the Next app:

- TypeScript strict checks through `tsc --noEmit` or the framework build.
- ESLint for code quality.
- Vitest or Jest for unit, route, persistence, adapter, and integration tests.
- Playwright for browser smoke tests when real flows exist.
- PostgreSQL service in CI for database-backed tests once Prisma is added.

The implementation change should choose the exact runner in sympathy with the scaffold that exists at that point. Avoid adding multiple overlapping test runners without a clear reason.

## GitHub Actions

Start with one pull request workflow:

- `install`: install dependencies with the repository package manager.
- `lint`: run linting.
- `typecheck`: run TypeScript checks when a script exists.
- `test:unit`: run fast tests.
- `test:integration`: run database-backed tests with a PostgreSQL service once persistence exists.
- `build`: run the production Next build.

CI should be deterministic:

- Do not require real eBay credentials for default PR checks.
- Use mocked eBay HTTP responses or recorded fixtures.
- Keep secrets out of logs.
- Fail on test failures, type errors, lint errors, or build failures.

## Advisory AI Review

Add an optional, non-blocking pull request workflow once repository tests are in place. The workflow should review the diff and OpenSpec alignment, then post advisory feedback or a workflow summary.

Configuration:

- `OPENAI_API_KEY` or equivalent provider secret stored in GitHub Actions secrets.
- `AI_REVIEW_MODEL` stored as an Actions variable or environment value so the review model can differ from the implementation model.
- Prompt includes the active OpenSpec change, changed files, and test output summaries.

Initial review focus:

- Does the change satisfy the relevant OpenSpec requirements and tasks?
- Are auth negative paths tested?
- Are eBay token values prevented from being persisted or exposed?
- Are user-owned records consistently scoped by user?
- Are provider calls mocked in CI?

The AI review job should be advisory at first. It may fail only for infrastructure errors if that proves useful, but it should not block merging based on model judgment until the team explicitly changes that policy.

## Risks And Decisions

- Tests should not overfit early implementation details. The most valuable tests assert contracts: user ownership, session-only token handling, idempotent import, and provider boundary normalization.
- Real eBay sandbox tests are useful, but they should run manually or on a separate opt-in workflow because credentials and provider state can be unstable.
- AI review can add useful second-pass scrutiny, but deterministic checks must remain the merge gate.
