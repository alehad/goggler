# Tasks: Fixture history UI

## 1. OpenSpec

- [x] Create OpenSpec change for fixture-backed history UI.
- [x] Document source selection, session requirements, UI behavior, and production guardrails.

## 2. History Source

- [x] Add history source config for `fixture` and `live`.
- [x] Default to fixture mode in development and live mode in production.
- [x] Reject fixture mode in production.
- [x] Add tests for source config behavior.

## 3. API Route

- [x] Add buying-history route requiring local auth.
- [x] Require active session-scoped eBay authorization before serving history.
- [x] Return fixture lost/won data and aggregate counts.
- [x] Add route tests for auth, connection, fixture, production guardrail, and live placeholder behavior.

## 4. UI

- [x] Load history from the API after sign-in/connect state is known.
- [x] Render lost bid fixture data in Watching.
- [x] Render won fixture data in Purchases.
- [x] Add filters for all lost bids, never won, and eventually won.
- [x] Show a clear connection prompt when history is unavailable because eBay is not connected.

## 5. Verification

- [x] Run unit tests.
- [x] Run TypeScript check.
- [x] Run advisory security review.
