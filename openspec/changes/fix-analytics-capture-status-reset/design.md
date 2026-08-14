# Design: Fix Analytics captured status resetting on tab switch

## Change

`Home` (`app/page.tsx`) gains:

```ts
function markItemsCaptured(itemIds: string[]) {
  setHistoryState((current) => {
    if (current.status !== "ready") {
      return current;
    }
    const idSet = new Set(itemIds);
    return {
      ...current,
      history: {
        ...current.history,
        endedWatchlistItems: current.history.endedWatchlistItems.map((item) =>
          idSet.has(item.itemId) ? { ...item, captured: true } : item
        )
      }
    };
  });
}
```

passed to `Analytics` as `onItemsCaptured={markItemsCaptured}`.

`Analytics` drops its local `locallyCapturedIds` state and the `captured = locallyCapturedIds.includes(item.itemId) || item.captured` merge in the `items` memo (now just uses `item.captured` directly, since it's authoritative). `captureVenueItemIds` calls `onItemsCaptured(captured)` instead of `setLocallyCapturedIds(...)`.

No API or persistence changes — `/api/market-insights/capture` already returns the correctly-captured ids; the bug was that the client threw that information away on tab switch instead of writing it back into the shared `historyState`.

## Testing

- Manual: capture an item on Analytics, switch to another tab, switch back — confirm it still shows "Captured" and the "Add to history" button is gone.
- No new unit/integration tests needed — this is a pure client state-lifting fix with no new logic branches beyond what's already covered by existing capture-flow tests (which exercise the API route and persistence layer, unaffected here).
