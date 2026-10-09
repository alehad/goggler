# Tasks: Server-side matching preferences

- [ ] Create OpenSpec change documenting the design.
- [ ] Wait for user sign-off on this design before implementing.

## Backend

- [ ] Add `MatchingPreferences` model to `prisma/schema.prisma`; hand-author the migration (same workaround as the `deletedAt` soft-delete migration: Neon HTTP adapter raw SQL + temporarily lifting the local `goggler_prod` read-only guard).
- [ ] New `src/persistence/matching-preferences.ts`: `getMatchingPreferencesForUser`, `setMatchingPreferencesForUser`.
- [ ] New `app/api/matching-preferences/route.ts`: `GET`, `PUT` (with CSRF check on `PUT`).
- [ ] Update all nine routes listed in the proposal to load persisted preferences instead of parsing client input; delete the now-dead client-input parsing in each.
- [ ] New `test/persistence/matching-preferences.integration.mjs`.
- [ ] New route tests for `GET`/`PUT /api/matching-preferences` in `test/ebay/routes.test.mjs`.
- [ ] Update existing tests in `test/ebay/routes.test.mjs` that currently pass `exactTitleMatch`/`criteriaText` per-request to instead seed the persisted value first.
- [ ] `npm run build`, `npm run lint`, `npm run test:unit`, `npm run test:persistence` clean.

## Web app

- [ ] Delete `localStorage` read/write and the top-level `matchingPreferences` state/threading in `app/page.tsx`.
- [ ] `Account` component: load via `GET` on mount, save via `PUT` on an explicit Save action.

## macOS app

- [ ] New `MatchingPreferences: Codable, Equatable, Sendable` in `GogglerModels.swift`.
- [ ] Delete `DefaultMatchingPreferences.swift`; remove its two usages (`AnalyticsView.askAssistant`, `AnalyticsView.loadMatchedSales`).
- [ ] `SettingsView.swift`: new "Matching preferences" section — load on appear, save via explicit Save button.
- [ ] `xcodegen generate`, `xcodebuild build`, `xcodebuild test` clean.

## Ship

- [ ] Manual functional testing pause — bidirectional check: change preferences from web, confirm macOS reflects it (and vice versa) without any client-side change on the reading side.
- [ ] Run dual security review (security-review skill + Copilot CLI).
- [ ] Ship via PR.
