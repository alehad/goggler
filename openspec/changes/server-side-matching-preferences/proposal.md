# Proposal: Server-side matching preferences

## Why

`matching-preferences`' original proposal explicitly scoped persistence out: "Persisting preferences to a server database" was listed as Out Of Scope. The result: `exactTitleMatch`/`criteriaText` live only in the web browser's `localStorage` (`app/page.tsx`), and the macOS app always sends a hardcoded default (`DefaultMatchingPreferences.swift`). Both clients independently supply these values on every request that needs them; the server trusts whatever each client sends.

This is the confirmed root cause of "the same feature gives different results on web vs macOS" investigated earlier today: the same item can resolve to different relisting matches depending on which client asked, because the two clients can be (and in the macOS case, always are) using different matching criteria. It's also now a direct violation of the `Server-Side Business Logic Invariant` just added to `AGENTS.md`: a setting that changes what the data is must be persisted server-side and read by the server, not supplied per-request by each client.

## What Changes

- **New persisted model**: `MatchingPreferences` (one row per user, keyed by `userId` — same `userId`-as-plain-string convention `WonItem`/`LostItem`/`MarketPriceRecord` already use, no real multi-user `User` table exists). Columns: `exactTitleMatch Boolean`, `criteriaText String`, `updatedAt`.
- **New persistence module** `src/persistence/matching-preferences.ts`: `getMatchingPreferencesForUser(userId)` (returns the saved row, or `DEFAULT_MATCHING_PREFERENCES` if none exists yet — never writes on read) and `setMatchingPreferencesForUser(userId, input)` (validates/bounds via the existing `parseMatchingPreferences`, then upserts).
- **New route** `GET/PUT /api/matching-preferences`: `GET` returns the current effective preferences for the session's user; `PUT` validates and persists a new value, returning what was actually saved (post-validation/bounding, so a client always knows the real effective value, not just an echo of its request).
- **Every existing route that currently parses `exactTitleMatch`/`criteriaText` from the client stops doing so and loads the persisted value instead**, via `getMatchingPreferencesForUser(currentUser.context.user.id)`:
  - `app/api/ebay/buying-history/route.ts` (GET and POST)
  - `app/api/ebay/buying-history/stream/route.ts`
  - `app/api/ebay/market-history/route.ts`
  - `app/api/ebay/search/route.ts`
  - `app/api/market-insights/capture/route.ts`
  - `app/api/market-insights/chat/route.ts`
  - `app/api/market-insights/matched-sales/route.ts`
  - `app/api/market-insights/matched-sales/summary/route.ts`
  - `app/api/market-insights/watchlist-automation/route.ts`

  No route accepts a client-supplied override after this change — that override is exactly the mechanism that let the two clients drift. The only way to change the effective preferences is the new `PUT /api/matching-preferences`.
- **Web app**: removes `localStorage` read/write and the `matchingPreferences` state threaded through ~10 fetch call sites in `app/page.tsx`. The `Account` tab's existing form becomes the only place preferences are read (via `GET` on mount) and written (via `PUT`, on an explicit Save action rather than per-keystroke).
- **macOS app**: deletes `DefaultMatchingPreferences.swift` and the two request-body/query-item usages that sent it (`AnalyticsView.askAssistant`, `AnalyticsChart`'s matched-sales fetch) — the server no longer reads these, so sending them is dead weight. Adds a "Matching preferences" section to `SettingsView.swift` (the one place macOS already keeps account/config-level settings), with the same exact-title-match toggle and criteria text field as web, loaded via `GET` and saved via `PUT` through a small new `GogglerModels.MatchingPreferences` model and `GogglerAPIClient` calls — the first time macOS gets to read *or* write anything resembling a user preference.

## Out of Scope

- Multi-user support beyond the existing single fixed `userId` convention — this reuses that convention, doesn't change it.
- Any change to the matching algorithm itself (`relistingGroupForTitle`, `criteriaMatchForTitle`, etc.) — this only changes where the *configuration* for that algorithm comes from.
- A "preview without saving" mode for either client — deliberately not offered; it would reopen the exact gap this closes (a client computing against a value that isn't what's actually persisted).

## Success Criteria

- Changing matching preferences in either client's settings UI changes the *other* client's results too, without that client doing anything — proof that both are reading the same persisted, server-side value.
- No route under `app/api/` accepts or honors a client-supplied `exactTitleMatch`/`criteriaText` anymore; the only way to change effective preferences is `PUT /api/matching-preferences`.
- macOS no longer has a hardcoded matching-preferences default anywhere in its source.
- `npm run build`, `npm run lint`, `npm test:unit` (existing + new) clean on the web side; `xcodegen generate`, `xcodebuild build`, `xcodebuild test` clean on the macOS side.
