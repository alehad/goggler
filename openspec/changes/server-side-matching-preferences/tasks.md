# Tasks: Server-side matching preferences

- [x] Create OpenSpec change documenting the design.
- [x] Wait for user sign-off on this design before implementing.

## Backend

- [x] Add `MatchingPreferences` model to `prisma/schema.prisma`; hand-author the migration (same workaround as the `deletedAt` soft-delete migration: Neon HTTP adapter raw SQL + temporarily lifting the local `goggler_prod` read-only guard). Applied to `goggler_test`, `goggler_prod` (local), and Neon.
- [x] New `src/persistence/matching-preferences.ts`: `getMatchingPreferencesForUser`, `setMatchingPreferencesForUser`.
- [x] New `app/api/matching-preferences/route.ts`: `GET`, `PUT` (with CSRF check on `PUT`).
- [x] Update all nine routes listed in the proposal to load persisted preferences instead of parsing client input; delete the now-dead client-input parsing in each. Also found and removed a tenth, undocumented client-input-parsing spot (`market-history/route.ts`'s own helper) and a third macOS client-send site (`BuyingHistoryStore.swift`) the proposal's audit had missed.
- [x] New `test/persistence/matching-preferences.integration.mjs` — 5 tests (default-without-writing, save-and-reload, overwrite-not-duplicate, validate/bound oversized input, per-user isolation).
- [x] New route tests for `GET`/`PUT /api/matching-preferences` in `test/ebay/routes.test.mjs` — 3 tests (default when unsaved, CSRF rejection, validated echo on save).
- [x] Updated 5 existing test call sites in `test/ebay/routes.test.mjs` that previously sent now-dead `exactTitleMatch`/`criteriaText` request fields — removed the dead fields and renamed two tests that were actually testing CSRF/success shape, not matching behavior (their assertions never depended on the sent values matching the default, confirmed by inspection before editing).
- [x] `npm run build` clean. `npm run test:unit` (217/217) and `npm run test:persistence` (61/61) clean. `npm run lint` hits the same pre-existing interactive-ESLint-setup prompt noted earlier this session — not something this change introduced, skipped consistent with that precedent.

## Web app

- [x] Delete `localStorage` read/write and the top-level `matchingPreferences` state/threading in `app/page.tsx` — removed from `Dashboard`, `Won`, and `Analytics`, plus the dead `storedCriteriaText`/`LEGACY_DEFAULT_MATCHING_CRITERIA_TEXTS` migration helper.
- [x] `Account` component: load via `GET` on mount, save via `PUT` on an explicit Save action, with its own saving/message state.

## macOS app

- [x] New `MatchingPreferences: Codable, Equatable, Sendable` in `GogglerModels.swift`, plus `MatchingPreferencesCodingTests` (decode + encode/decode round-trip).
- [x] Delete `DefaultMatchingPreferences.swift`; remove all three usages (`AnalyticsView.askAssistant`, `AnalyticsView.loadMatchedSales`, and `BuyingHistoryStore.loadBuyingHistory` — the third one found during implementation, not listed in the original proposal).
- [x] `SettingsView.swift`: new "Matching preferences" section — load on appear via `.task`, save via explicit Save button, disabled until the draft actually differs from the last-saved value.
- [x] `xcodegen generate`, `xcodebuild build`, `xcodebuild test` clean — 43/43 (41 existing + 2 new).

## Ship

- [x] Manual functional testing pause. Before handing off, ran my own deterministic smoke test against the live backend through its real origin (`https://goggler.tailde35d2.ts.net`, the same path both real clients use): `PUT` with a distinguishing value, `GET` reflects it, restored the default afterward. Confirmed the full save/load round-trip works end-to-end. (Found along the way: directly `curl`-ing the standalone server on raw `localhost:3000` fails CSRF for *any* mutating route, old or new — reproduced identically on the pre-existing, untouched `chat` route, so it's not a regression from this change; the server's only supported access path is through its Tailscale-fronted origin, consistent with AGENTS.md.) The cross-client bidirectional check (change from web, confirm macOS reflects it without any macOS-side change, and vice versa) is left for the user, since that's the one part only a human comparing both live UIs can really confirm.
- [ ] Run dual security review (security-review skill + Copilot CLI).
- [ ] Ship via PR.
