# Design: Stream buying-history loading progress

## Event protocol

New file `src/ebay/history-stream.ts`:

```ts
export type HistoryFetchStage = "native_prices" | "relistings";

export type BuyingHistoryStreamEvent =
  | { type: "progress"; stage: HistoryFetchStage; completed: number; total: number }
  | { type: "partial"; history: EbayHistoryResponse }
  | { type: "complete"; history: EbayHistoryResponse }
  | { type: "error"; error: string };

export const PARTIAL_SNAPSHOT_BATCH_SIZE = 10;
```

Transport is plain NDJSON over a normal `fetch` response body (`Content-Type: application/x-ndjson`), not Server-Sent Events — `EventSource` only supports GET with no custom headers, and this app's existing CSRF/session pattern needs POST with an `Origin` check, so a manually-read `ReadableStream` is the simpler fit; the web app already does raw `fetch()` everywhere, no new library needed.

`partial` carries the *same* `EbayHistoryResponse` shape the app already renders — this is the key simplification: the frontend doesn't need any new incremental-diffing logic, it just replaces `historyState.history` wholesale each time a `partial`/`complete` event arrives, and every existing list (Home, Tracking, Purchases, Analytics) re-renders itself larger for free.

## `src/ebay/live-history-source.ts`

`mapWithConcurrency` (already used by `fetchNativeWatchlistPrices`) gains an optional per-item-done callback:

```ts
async function mapWithConcurrency<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>,
  onItemDone?: () => void
): Promise<void> {
  let index = 0;
  async function worker(): Promise<void> {
    while (index < items.length) {
      const current = index++;
      await fn(items[current]);
      onItemDone?.();
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
}
```

`fetchLiveEbayHistoryResponse` gains `onEvent?: (event: BuyingHistoryStreamEvent) => void` in its options, for the **`native_prices`** stage: today the function calls `fetchNativeWatchlistPrices` twice — once for `endedWatchlistItemsBeforeNativePrices`, once for `activeWatchListItems` — as two separate sequential `await`s. These become one combined stage with a shared running counter (`total` = ended count + active count, known upfront before either call starts), so progress reads e.g. "42 of 118" across both rather than resetting partway through. `fetchNativeWatchlistPrices` takes an optional `onItemDone` callback threaded into its `mapWithConcurrency` call.

The **`relistings`** stage is separate: the streaming route (like the existing non-streaming route) calls `fetchLiveEbayHistoryResponse` with `discoverRelistings: false`, then `refreshLiveHistoryDerivedData` afterward — relisting discovery actually happens inside *that* second call, via its own `discoverRelistingCandidates` → `fetchLiveRelistingCandidates` (`src/ebay/live-relisting-discovery.ts`, already sequential, capped at `DEFAULT_MAX_RELISTING_SEARCHES = 12`). So `refreshLiveHistoryDerivedData` needs its *own* `onEvent?: (event: BuyingHistoryStreamEvent) => void` parameter, threaded down to `fetchLiveRelistingCandidates`'s `for` loop, firing a `progress`/`partial` pair after each search resolves — mirroring the same checkpoint logic as the native-price stage, just assembled via `rebuildHistoryResponse` (which this function already calls) instead of the full `assembleHistoryResponse` helper below.

After each stage's callback fires, `fetchLiveEbayHistoryResponse` emits a `progress` event via `onEvent`, and every `PARTIAL_SNAPSHOT_BATCH_SIZE`th completion (or the stage's last item) it also emits a `partial` event — assembled by extracting the existing tail-end "build the response object" logic (currently the second half of the function body, lines ~100-151) into a standalone `assembleHistoryResponse(...)` helper that can be called at each checkpoint as well as once at the very end. Calling it mid-flight is safe and cheap: it's pure, in-memory, no network calls, and already tolerates partially-filled data by design — `mergeNativePrices` already falls back to `item.currentPrice` for any `itemId` not yet present in the native-price `Map` (`nativeWatchlistPrices.get(item.itemId) ?? item.currentPrice`, `live-history-source.ts:428`), so an in-progress snapshot is simply less-enriched, never wrong or crashing. A `partial` snapshot taken during the `native_prices` stage naturally has `relistingCandidates: []` (not computed yet) — filled in as `relistings`-stage checkpoints land afterward, so the list keeps growing/improving across both stages.

This is purely additive — `onEvent` defaults to a no-op, so `fetchEndedWatchlistItems`, `refreshLiveHistoryDerivedData`, every existing test, and the unchanged `/api/ebay/buying-history` route are all unaffected.

## New route: `app/api/ebay/buying-history/stream/route.ts`

```ts
export async function POST(request: NextRequest) {
  const csrf = validateSameOriginRequest(request);
  if (!csrf.ok) {
    return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  }

  const currentUser = getOrCreateCurrentUser(request);
  const sourceStatus = getEbayHistorySourceStatus();
  if (!sourceStatus.ok) {
    return withInternalSessionCookie(NextResponse.json({ error: sourceStatus.error }, { status: 503 }), currentUser.setCookie);
  }
  const ebayAccess = requireSessionEbayAccessToken(currentUser.context.session.id);
  if (!ebayAccess.ok) {
    return withInternalSessionCookie(NextResponse.json({ error: "ebay_reauth_required" }, { status: 409 }), currentUser.setCookie);
  }
  if (sourceStatus.source !== "live") {
    // fixture mode: no real per-item latency to stream: fall back to one `complete` event
  }

  const body = (await request.json().catch(() => ({}))) as Partial<{ exactTitleMatch: boolean; criteriaText: string }>;
  const matchingPreferences = parseMatchingPreferences(body);

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (event: BuyingHistoryStreamEvent) => controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));

      try {
        const config = loadEbayConfig();
        const liveHistory = await fetchLiveEbayHistoryResponse(config, ebayAccess.accessToken, {
          discoverRelistings: false,
          matchingPreferences,
          onEvent: send
        });
        const withPersistedWonItems = await persistWonItemsAndMerge(liveHistory, currentUser.context.user.id, matchingPreferences);
        const withPersistedHistory = await persistLostItemsAndMerge(withPersistedWonItems, currentUser.context.user.id, matchingPreferences);
        const history = await refreshLiveHistoryDerivedData(config, withPersistedHistory, matchingPreferences, { onEvent: send });
        send({ type: "complete", history: await withCaptureStatus(history, currentUser.context.user.id) });
      } catch (error) {
        send({ type: "error", error: "live_history_error" });
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      ...(currentUser.setCookie ? { "Set-Cookie": currentUser.setCookie } : {})
    }
  });
}
```

Key points:
- Every check that can still return a normal HTTP error status (CSRF, source unavailable, reauth required) happens *before* the `ReadableStream` is constructed — those stay as ordinary `NextResponse.json(...)` responses with real status codes, exactly like the existing route today. Only once streaming has actually started does an error become an in-band `error` event instead of an HTTP status, since headers (200 OK) are already committed at that point.
- `persistWonItemsAndMerge`/`persistLostItemsAndMerge`/`withCaptureStatus` — the DB-touching steps — run exactly once, only on the final assembled history, not on every `partial` checkpoint. Deliberate: partial snapshots are a live-data-only preview (no persisted-merge, no captured-status flags); the `complete` event is byte-for-byte equivalent to what the non-streaming endpoint returns today for the same inputs. Confirmed no behavior change to the finished result — see proposal.md's success criteria.
- `discoverRelistings: false` is passed to `fetchLiveEbayHistoryResponse` the same way the existing route already does, with `refreshLiveHistoryDerivedData` running relisting discovery afterward — this route mirrors that exact existing two-step shape, just with progress events layered on top of the first step. (Relisting-search progress in this shape actually comes from `refreshLiveHistoryDerivedData`'s call to `discoverRelistingCandidates`, so `refreshLiveHistoryDerivedData` also needs the optional `onEvent` hook threaded through — see tasks.md.)

## Frontend: `app/page.tsx`

`refreshBuyingHistory` (currently `app/page.tsx:311`) changes from a single `fetch().then(r => r.json())` to reading the streamed body:

```ts
async function refreshBuyingHistory() {
  setHistoryState({ status: "loading" });
  setStreamProgress(undefined);

  let response: Response;
  try {
    response = await fetch("/api/ebay/buying-history/stream", { method: "POST", /* ...existing headers/body... */ });
  } catch {
    setHistoryState({ status: "unavailable", message: "..." });
    return;
  }
  if (!response.ok || !response.body) {
    // existing non-2xx handling, unchanged
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      const event = JSON.parse(line) as BuyingHistoryStreamEvent;
      if (event.type === "progress") setStreamProgress({ stage: event.stage, completed: event.completed, total: event.total });
      else if (event.type === "partial" || event.type === "complete") {
        setHistoryState({ status: "ready", history: event.history });
        if (event.type === "complete") setStreamProgress(undefined);
      } else if (event.type === "error") {
        setHistoryState({ status: "unavailable", message: "..." });
        setStreamProgress(undefined);
      }
    }
  }
}
```

A new piece of state, `const [streamProgress, setStreamProgress] = useState<{ stage: HistoryFetchStage; completed: number; total: number } | undefined>()`, sits alongside `historyState` rather than restructuring the `HistoryState` union — `HistoryState`'s "ready"/"loading" variants are checked in ~15+ places across the file, so adding a field there would ripple everywhere for no benefit; a separate piece of state that's simply "defined while a stream is in flight, cleared on complete/error" is far less invasive and exactly matches how it's actually used (a transient overlay, not part of the settled data shape).

Rendering:
- `HistoryEmptyState`/`getHistoryMessage` (`app/page.tsx:2434-2459`): while `status` is `"loading"` and `streamProgress` is set, show e.g. `` `Loading buying history — matching relistings (${completed} of ${total})…` `` (stage-specific label) instead of the static string; falls back to the current plain message if no progress has arrived yet (covers the brief moment before the first `progress` event, and the fixture-mode/non-live path where the stream just sends one `complete` event immediately).
- A small inline banner near the top of the Home tab's ready content (alongside the existing `warnings` banner at `app/page.tsx:775`), shown whenever `streamProgress` is defined regardless of `historyState.status` — since a `partial` snapshot flips `historyState.status` to `"ready"` before the stream finishes, this is what keeps the "X of Y" counter visible while the list is already rendering and still growing.

## Testing

- `test/ebay/live-history-source.test.mjs`: extend with a mocked-fetch scenario asserting `onEvent` receives `progress` events with monotonically increasing `completed` (up to the known `total`) across both native-price sub-stages combined, and that a `partial` snapshot's `EbayHistoryResponse` is well-formed and matches what the final assembled response would contain for the already-resolved subset (same assertions style as this file's existing tests, which already mock `fetch` per-list).
- New tests directly in `test/ebay/routes.test.mjs` (not a separate file — this file already tests the sibling non-streaming route with the same helpers/mocks, and that route's own persistence calls already run there without a real database configured, confirming persistence degrades to a no-op in this unit-test context): drives the new route end-to-end against mocked eBay responses, reads the NDJSON body, asserts the event sequence (some number of `progress`/`partial` events followed by exactly one `complete`), and asserts the `complete` event's `history` is identical to what `POST /api/ebay/buying-history` returns for the same fixture inputs — the parity check backing this proposal's "identical final state" success criterion.
- The frontend change has no automated test coverage (this repo has no component/browser test harness for `app/page.tsx` — same precedent as the recent `fix-analytics-filter-row-layout` and `fix-analytics-chart-scroll-into-view` UI-only changes). Verified manually: initial connect and "Refresh feed" on the real Home page, confirming the list grows progressively and the "X of Y" counter updates and clears correctly, including an error-path check (e.g. temporarily forcing a mid-stream failure) to confirm the `error` event surfaces the existing unavailable-state UI rather than hanging.
