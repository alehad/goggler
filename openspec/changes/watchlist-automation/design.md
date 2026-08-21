# Design: Discover live auctions from purchase/price history and add them to the watchlist

## New Trading API call: `AddToWatchList`

`src/ebay/trading-client.ts` gains, mirroring the existing `GetMyeBayBuying`/`GetOrders` pattern exactly:

```ts
export function buildAddToWatchListRequest(config: EbayConfig, accessToken: string, itemId: string): EbayTradingRequest {
  assertTrustedTradingApiUrl(config);
  return {
    url: config.tradingApiUrl,
    headers: {
      "Content-Type": "text/xml",
      "X-EBAY-API-CALL-NAME": "AddToWatchList",
      "X-EBAY-API-COMPATIBILITY-LEVEL": TRADING_API_COMPATIBILITY_LEVEL,
      "X-EBAY-API-SITEID": config.tradingSiteId,
      "X-EBAY-API-IAF-TOKEN": accessToken
    },
    body: [
      '<?xml version="1.0" encoding="utf-8"?>',
      '<AddToWatchListRequest xmlns="urn:ebay:apis:eBLBaseComponents">',
      "  <WarningLevel>High</WarningLevel>",
      `  <ItemID>${escapeXml(itemId)}</ItemID>`,
      "</AddToWatchListRequest>"
    ].join("\n")
  };
}

export async function fetchAddToWatchList(
  config: EbayConfig,
  accessToken: string,
  itemId: string,
  options: { fetch?: typeof fetch } = {}
): Promise<{ ack: string }> {
  const fetchImpl = options.fetch ?? fetch;
  const request = buildAddToWatchListRequest(config, accessToken, itemId);
  const response = await fetchImpl(request.url, { method: "POST", headers: request.headers, body: request.body });

  if (!response.ok) {
    throw new EbayTradingApiError(`eBay Trading API request failed with status ${response.status}`, { status: response.status });
  }

  const xml = await response.text();
  const ack = firstText(xml, "Ack");
  if (!ack || (ack !== "Success" && ack !== "Warning")) {
    throw new EbayTradingApiError(`eBay Trading API returned ${ack ?? "no Ack"}`, { ack, errorCodes: tradingApiErrorCodes(xml) });
  }

  return { ack };
}
```

`itemId` needs XML-escaping (a new tiny `escapeXml` helper) since, unlike existing calls, it's interpolated directly into the request body rather than only ever appearing in parsed *responses*. Whether this needs to be user-input-resistant matters less than usual since `itemId` always originates from our own Browse API search results in practice, but it costs nothing to escape it properly.

## `fetchEbayBrowseSearchResponse` gains an optional buying-options filter

`src/ebay/browse-client.ts`:

```ts
export async function fetchEbayBrowseSearchResponse(
  config: EbayConfig,
  appAccessToken: string,
  query: string,
  options: {
    categoryIds?: string[];
    fetch?: typeof fetch;
    limit?: number;
    matchingPreferences: MatchingPreferences;
    buyingOptions?: Array<"AUCTION" | "FIXED_PRICE">;
  }
): Promise<EbayBrowseSearchResponse> {
  // ...
  const buyingOptions = options.buyingOptions ?? ["AUCTION", "FIXED_PRICE"];
  url.searchParams.set("filter", `buyingOptions:{${buyingOptions.join("|")}}`);
  // ...
}
```

Existing callers (`live-relisting-discovery.ts`) don't pass this option, so their behavior (both auction and fixed-price) is unchanged. The new orchestration passes `buyingOptions: ["AUCTION"]`.

## New persistence function: `listAllWonItems`

`src/persistence/won-items.ts`, mirroring `listAllMarketPriceRecords` in `market-price-records.ts`:

```ts
export async function listAllWonItems(
  userId: string,
  prisma: PrismaClient | undefined = getPrismaClient()
): Promise<EbayBuyingHistoryItem[]> {
  if (!prisma) {
    return [];
  }

  const items = await prisma.wonItem.findMany({ where: { userId, venue: "ebay" } });

  return items.map((item) => ({
    itemId: item.venueItemId,
    title: item.title,
    list: "WonList" as const,
    currentPrice: item.itemPriceAmount !== null && item.currency ? { value: item.itemPriceAmount.toNumber(), currency: item.currency } : undefined,
    endTime: item.purchasedAt?.toISOString(),
    sellerUserId: item.sellerUserId ?? undefined,
    conditionDisplayName: item.conditionDisplayName ?? undefined,
    categoryId: item.categoryId ?? undefined,
    categoryName: item.categoryName ?? undefined,
    imageUrl: item.imageUrl ?? undefined,
    itemWebUrl: item.itemWebUrl ?? undefined
  }));
}
```

## Shared category-match heuristic

`live-relisting-discovery.ts`'s `sameCategory`/`isRecordCategory`/`normalizedCategoryName` helpers get extracted into a small shared module — `src/ebay/relisting-match.ts` — and both `live-relisting-discovery.ts` and the new orchestration import from there, rather than duplicating the logic. This is a pure refactor of existing, already-tested behavior; no behavior change for the existing caller.

## New orchestration: `src/market-insights/watchlist-automation.ts`

Revised after manual testing surfaced that a single final result blob, sequential unbounded-wait searches, and a home for the trigger button that never shows live items were all real usability problems, not just polish:

```ts
export type WatchlistAutomationCandidate = {
  itemId: string; // legacy Trading API ID, not the Browse API REST-format ID
  title: string;
  recordId: string;
  currentPrice?: { value: number; currency: string };
  endsAt?: string;
  sellerUserId?: string;
  conditionDisplayName?: string;
  categoryId?: string;
  categoryName?: string;
  imageUrl?: string;
  itemWebUrl?: string;
};

export type WatchlistAutomationEvent =
  | { type: "search_started"; recordId: string; completed: number; total: number }
  | { type: "search_completed"; recordId: string; candidatesFound: number; completed: number; total: number }
  | { type: "added"; candidate: WatchlistAutomationCandidate }
  | { type: "already_watched"; candidate: WatchlistAutomationCandidate }
  | { type: "failed"; candidate: WatchlistAutomationCandidate; reason: string }
  | { type: "done"; result: WatchlistAutomationResult };

export async function discoverAndWatchLiveAuctions(
  config: EbayConfig,
  userId: string,
  userAccessToken: string,
  matchingPreferences: MatchingPreferences,
  options: {
    fetch?: typeof fetch;
    maxSearches?: number; // default: unbounded
    maxAdds?: number; // default: DEFAULT_MAX_WATCHLIST_ADDS (20)
    searchConcurrency?: number; // default: DEFAULT_SEARCH_CONCURRENCY (5)
    onEvent?: (event: WatchlistAutomationEvent) => void;
  } = {}
): Promise<WatchlistAutomationResult>
```

Steps:
1. `Promise.all([listAllWonItems(userId), listAllMarketPriceRecords(userId)])`, concatenate.
2. Build a `Map<recordId, EbayBuyingHistoryItem>` via `catalogueIdForTitle` (first occurrence wins). `maxSearches` defaults to unbounded — searches every unique record ID found. `getEbayApplicationAccessToken(config, { scope: EBAY_BROWSE_SCOPE })` gets the app token once, up front.
3. **Search phase runs with bounded concurrency**, not sequentially: a small `mapWithConcurrency(items, limit, worker)` helper keeps `searchConcurrency` (default 5) requests in flight at once, starting the next as soon as one finishes — not "batches of 5 that wait for the slowest," a true rolling window. Results are written back by original index, so the final `candidates` array is in deterministic input order regardless of which search happened to finish first. Each record ID's search emits `search_started` then `search_completed` via `onEvent`.
4. Each matching row (filtered by `relistingGroupId` and `sameCategory`, same as before) becomes a full `WatchlistAutomationCandidate` — carrying price/image/seller/URL from the Browse API row, not just the bare `{itemId, title, recordId}` triple from the original design. This is what lets the UI render a real-looking row for a newly-added item without a second round-trip.
5. Fetch the current watchlist once via `fetchGetMyeBayBuyingPages`, build a `Set<itemId>` (legacy IDs, matching `candidate.itemId`).
6. **Add phase stays sequential** (unlike search) — it's a real account mutation, not a read, and there's no benefit to racing multiple `AddToWatchList` calls. For each candidate not already watched (capped at `maxAdds`): call `fetchAddToWatchList`; emit `added` or `failed` via `onEvent` as each one resolves; `already_watched` is emitted for skips.
7. Emit a final `done` event carrying the full `WatchlistAutomationResult`, and return that same result (so the function is still directly callable/testable without wiring a stream).

## New API route: `app/api/market-insights/watchlist-automation/route.ts`

Auth/CSRF/session handling is unchanged from the original design (CSRF check, `getOrCreateCurrentUser`, `requireSessionEbayAccessToken` → 409 on failure, `parseMatchingPreferences` from the body) — those still return a plain JSON error response synchronously, before any streaming starts.

Once past those checks, the route returns a **streaming NDJSON response** (`Content-Type: application/x-ndjson`) instead of a single JSON body: a `ReadableStream` whose `start` callback calls `discoverAndWatchLiveAuctions` with `onEvent` wired to `controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"))`, closing the stream once the call resolves (or emitting a `{"type":"error"}` line on an unexpected throw). Plain newline-delimited JSON was chosen over Server-Sent Events / `EventSource`: this is a one-shot job kicked off by a `POST` with a body, and `EventSource` only supports `GET` with no request body and handles reconnection semantics this doesn't need — a raw streamed `fetch` response read via `response.body.getReader()` is simpler and a better fit.

The successful, non-throwing result is also still logged server-side (`console.info("Watchlist automation result", {...})`) once the run completes, so what happened is visible in server logs even without reading the client's rendered summary.

## UI

The button moved from the Analytics tab to the **Home tab** (the `Dashboard` component), for a reason discovered mid-testing, not anticipated in the original design: Analytics only shows auctions that have *already ended* (`endedWatchlistItems` — candidates for price-history capture), so a newly-added *live* auction would never appear there until it ends days later. The Home tab's "On watchlist" view is where a live watchlist item is actually visible, so that's where the trigger belongs.

- `Dashboard` gains a `matchingPreferences` prop (threaded from the same parent state `Analytics`/`Won`/`Account` already receive it from).
- Clicking the button starts reading the NDJSON stream. Each line is parsed and dispatched:
  - `search_started`/`search_completed` update a one-line status message ("Searching BNJ71001... (4/187 record IDs)").
  - `added` does two things: appends a human-readable line to the status, and converts the candidate into a client-side `HomeFeedRow` (`modelList: "ebay"`, `section: "watchlist"`, tagged `"Just added"`) prepended to a small `justAddedRows` state list — which the `rows` `useMemo` merges in ahead of the real fetched rows (deduped by id, so nothing double-renders once the real data catches up). This is what makes newly-added items appear at the top of the "On watchlist" view *during* the run, not only after it finishes.
  - `done` renders the same summary text the original single-shot design produced (searched/found/added/already-watched/failed counts).
- After the stream closes, `refreshBuyingHistory()` runs once to reconcile with eBay's actual current state, and `justAddedRows` is cleared — the real fetched data supersedes the optimistic rows at that point.

## Why this shape

- **Reuses everything that already exists** (`catalogueIdForTitle`, `fetchEbayBrowseSearchResponse`, `GetMyeBayBuying`, the auth/CSRF/session pattern) rather than inventing parallel mechanisms — the only genuinely new capability is the `AddToWatchList` call itself.
- **A separate `maxAdds` cap, distinct from `maxSearches`**: searching is read-only and cheap to bound generously; adding to the watchlist is a real mutation of the user's actual eBay account with no per-item confirmation step (a manual button click is the confirmation for the whole batch, not each item) — worth capping more conservatively so a bad regex or an unexpectedly broad match set can't silently add dozens of unwanted items in one click.
- **Per-item failure isolation**: `AddToWatchList` can plausibly fail for reasons unrelated to our logic being wrong (item already ended between search and add, seller restrictions, etc.) — one such failure shouldn't hide whether the other, valid matches succeeded.
- **Extracting `sameCategory` into a shared module** avoids duplicating matching logic that's already been tuned and tested for `live-relisting-discovery.ts` — same matching quality bar, one implementation.
- **Concurrency limit on search, not on add**: searches are independent reads with no ordering requirement between them, so running several at once is free correctness-wise and directly addresses the multi-minute wall-clock cost of unbounded search coverage. Adds are sequential and capped separately (`maxAdds`) because they're real, ordered account mutations — parallelizing writes would only risk tripping rate limits for no benefit, since the true bottleneck here is search volume, not add volume.
- **Streaming (NDJSON), not a second polling endpoint**: a polling design would need server-side job-state storage (this app has no job queue or persistent background-task infrastructure) just to answer "how far along is it" between polls. A streamed response makes the HTTP request itself the progress channel — no new storage, no new endpoint, and it naturally ends when the job ends.
- **Optimistic row injection, reconciled by a real refresh at the end**: showing a synthetic row the instant an item is added is what makes the run feel "live" rather than like a spinner; running a full `refreshBuyingHistory()` once at the end (rather than after every single add) keeps the cost of reconciliation to one real fetch instead of N, while still guaranteeing the final state matches eBay's actual data.

## Testing

- Unit tests for `buildAddToWatchListRequest`/`fetchAddToWatchList` (request shape, Ack-success/failure parsing) — same style as existing `trading-client.test.mjs` coverage for `GetMyeBayBuying`.
- Unit tests for the `buyingOptions` filter change in `fetchEbayBrowseSearchResponse` (default unchanged, explicit `["AUCTION"]` narrows the filter param).
- Unit test for `listAllWonItems` (persistence integration test, same style as `listAllMarketPriceRecords`'s existing test).
- Unit tests for `discoverAndWatchLiveAuctions`: dedup across won items + history, auction-only filtering, category-match filtering, skips already-watched items, respects `maxAdds`, isolates a single item's failure from the rest of the batch, never exceeds `searchConcurrency` in-flight searches at once, emits the expected `onEvent` sequence (`search_started` → `search_completed` → `added`/`already_watched`/`failed` → `done`) with full candidate data on each event.
- Manual confirmation: with a connected Production eBay account, run the flow via the UI button and confirm a real, currently-live auction listing for a known catalogue number actually appears on the eBay watchlist afterward, that progress is visible during the run (not just a single result at the end), and that newly-added items appear at the top of the Home tab's watchlist view without a manual reload.

### A real bug caught during manual testing, worth recording

The first live run against Production eBay reported "Searched 12 record IDs, found 1 live auction. Added 0 new items to the watchlist" — a candidate was found but silently failed to add, with no visibility into why (a second bug in its own right — `AddToWatchList` failures were being collected into `result.failed` but the UI never displayed that field, so the failure was invisible to the user).

Root cause: eBay's Browse API returns item identifiers in its newer REST format (`v1|<legacy-id>|0`), which is what `HomeFeedRow.sourceItemId`/`candidate.itemId` held. The legacy Trading API's `AddToWatchList` call — and the `GetMyeBayBuying` watchlist read used for the already-watched check — both expect the *old* plain numeric legacy item ID, not the REST-format string. Passing the REST-format ID to `AddToWatchList` gets silently rejected by eBay (`Ack=Failure`), and comparing REST-format candidate IDs against legacy-format watchlist IDs for the already-watched check would never match even for the same real item, either.

This was a **pre-existing gap in `browse-client.ts`**, not something introduced by this change — it just had no prior consumer that made a real eBay write with a Browse-API-sourced ID (the one existing "add to watchlist" UI button, on live-relisting-discovery candidate cards, is purely local UI state and never calls eBay's API at all). This change is the first real eBay-mutation to depend on that ID being usable elsewhere, and exposed the gap.

**Fix**: `HomeFeedRow` gains a `legacyItemId` field, populated from eBay's `item.legacyItemId` in `parseBrowseRow` (`src/ebay/browse-client.ts`), alongside (not replacing) the existing REST-format `sourceItemId` — other consumers of `sourceItemId` don't call any legacy API and are unaffected. `discoverAndWatchLiveAuctions` now builds candidates from `row.legacyItemId`, and skips a row entirely if it's missing (rather than falling back to the REST id, which would just fail the same way). The UI message was also fixed to surface `failed` items and their reasons, so a failure like this is never silently invisible again. The integration tests were rewritten to use distinct REST-format and legacy-format IDs (matching real eBay data shapes) instead of a single shared string per candidate, specifically so this class of bug can't hide behind a self-consistent mock again.

### A second bug caught on the next manual run: the search cap was far too low

After the `legacyItemId` fix, the next live run reported "Searched 12 record IDs, found 1 live auction" — but the user's real dataset has roughly 150-200 distinct record IDs across purchases and price history. The cap was wrong: `discoverAndWatchLiveAuctions` defaulted `maxSearches` to `DEFAULT_MAX_RELISTING_SEARCHES` (12), a constant borrowed from `live-relisting-discovery.ts` without reconsidering whether it fit this feature's very different usage pattern — that constant exists to keep the *home feed page* fast on every automatic load, not to bound a manual, occasional button click that's supposed to cover the user's whole dataset.

**Fix**: `maxSearches` now defaults to unbounded (`Number.POSITIVE_INFINITY`) — every unique record ID found gets searched — with the option parameter kept available as an explicit override. The accepted tradeoff, confirmed with the user: a full run against ~150-200 record IDs takes a few minutes (sequential Browse API calls), which is fine for an occasional manual action but would not be for something run automatically or frequently. `maxAdds` (the separate cap on actual watchlist *writes*, discussed above) is unaffected and unchanged.

### A third finding, after adding concurrency/streaming: one record ID can starve the rest of the add budget

With streaming/concurrency/unbounded search in place, a real run against Production eBay found 54 candidates across 112 record IDs, but 20 of the 20 added (the full `maxAdds` budget) were almost all the same record — "ABBA Arrival" (`DSP5102`) — because one seller happened to be running many separate one-copy auctions of that exact pressing simultaneously. Not a matching bug (each was a genuinely distinct, real, correctly-matched listing) but a real design gap: `maxAdds` was a single global cap with no per-record limit, so a record ID with an unusually large number of live listings from one seller could consume the entire run's budget and leave every other record ID's matches unprocessed, even ones that also had live matches.

**Fix**: added `maxAddsPerRecord` (default `DEFAULT_MAX_ADDS_PER_RECORD = 3`), tracked via a `Map<recordId, number>` alongside the existing `maxAdds` global cap — a candidate is skipped (counted in a new `skippedPerRecordCap` result field, and a new `skipped_per_record_cap` event) once its own record ID has already hit the per-record limit for this run, regardless of how much of the global budget remains. This is a second, independent cap layered on top of the first, not a replacement — `maxAdds` still bounds the total, `maxAddsPerRecord` bounds how much of that total any single record ID can claim.
