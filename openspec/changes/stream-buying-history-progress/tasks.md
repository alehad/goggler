# Tasks: Stream buying-history loading progress

- [x] Create OpenSpec change documenting the design (including confirming the streaming-vs-cosmetic-progress approach with the user directly).
- [x] Wait for user sign-off on this design before implementing.
- [x] Add `src/ebay/history-stream.ts`: `BuyingHistoryStreamEvent`, `HistoryFetchStage`, `PARTIAL_SNAPSHOT_BATCH_SIZE`.
- [x] `mapWithConcurrency` in `live-history-source.ts`: add optional `onItemDone` callback.
- [x] `fetchNativeWatchlistPrices`: add optional `onItemDone` callback, threaded into `mapWithConcurrency`.
- [x] `fetchLiveEbayHistoryResponse`: add `onEvent` option; combine the two `fetchNativeWatchlistPrices` calls (ended + active) into one shared-counter `native_prices` stage; extract the response-assembly tail into a reusable `assembleResponse` helper so it can be called at each `partial` checkpoint as well as at the end.
- [x] `fetchLiveRelistingCandidates` (`live-relisting-discovery.ts`): add optional `onSearchDone` callback fired after each sequential search request resolves, carrying the growing candidates array so far.
- [x] `refreshLiveHistoryDerivedData`: add `onEvent` option, threaded to `discoverRelistingCandidates`/`fetchLiveRelistingCandidates`, emitting `progress`/`partial` events for the `relistings` stage via `rebuildHistoryResponse`.
- [x] New route `app/api/ebay/buying-history/stream/route.ts`: CSRF/source/reauth checks return normal JSON error responses as today; once past those, stream NDJSON events from a `ReadableStream`, running persistence + capture-status enrichment once, only on the final `complete` event. Fixture-mode source sends a single `complete` event.
- [x] Web `app/page.tsx`: `refreshBuyingHistory` reads the new endpoint's streamed body (`getReader()`/`TextDecoder`, NDJSON line splitting) instead of `fetch().then(r => r.json())`; new `streamProgress` state (separate from `HistoryState`, to avoid touching its ~15+ existing call sites); `partial`/`complete` events both flip `historyState` to `"ready"` with the received `history`.
- [x] `HistoryEmptyState`/`getHistoryMessage`: show stage-specific progress text when `streamProgress` is set, falling back to today's static message otherwise. Threaded to all four tabs (Home, Watching, Purchases, Analytics) since they share `refreshBuyingHistory`.
- [x] Progress banner (`.form-message`) shown near the top of the Home tab whenever `streamProgress` is defined, regardless of `historyState.status` (so it stays visible once partial results start rendering).
- [x] Extend `test/ebay/live-history-source.test.mjs`: `onEvent` receives monotonically increasing `progress` events for both the `native_prices` stage (via `fetchLiveEbayHistoryResponse`) and the `relistings` stage (via `refreshLiveHistoryDerivedData`); `partial` snapshots are well-formed and consistent with the already-resolved subset.
- [x] Extend `test/ebay/routes.test.mjs` (not a separate file — matches this repo's existing convention of testing the sibling non-streaming route in the same file/helpers): CSRF/reauth checks, fixture-mode single-`complete`-event streaming, live-mode progress+partial+complete sequence with a parity assertion against `POST /api/ebay/buying-history`'s response for identical mocked inputs, and a mid-stream-failure test confirming the `error` event fires with no leaked upstream/token detail.
- [x] `npx tsc --noEmit`, `npm run build`, `npm run test:unit` (214/214), `npm run test:persistence` (56/56), `npm run openspec:validate` (65/65).
- [x] Manual functional testing pause: user confirmed live on the real Home page ("it works").
- [x] Run dual security review (security-review skill + Copilot CLI), then ship via PR.
