# Design: Remove unwanted items from captured price history

## Persistence: `deleteMarketPriceRecords`

`src/persistence/market-price-records.ts`, matching the existing style of this file (`captureMarketPriceRecords`, `listAllMarketPriceRecords`):

```ts
export async function deleteMarketPriceRecords(
  userId: string,
  venueItemIds: string[],
  prisma: PrismaClient | undefined = getPrismaClient()
): Promise<{ deletedCount: number }> {
  if (!prisma || venueItemIds.length === 0) {
    return { deletedCount: 0 };
  }

  const result = await prisma.marketPriceRecord.deleteMany({
    where: { userId, venue: "ebay", venueItemId: { in: venueItemIds } }
  });

  return { deletedCount: result.count };
}
```

`deleteMany`'s `where` scopes by `userId` — a request can only ever delete its own user's rows, regardless of what `itemIds` are submitted; there's no way to reach another user's data this way.

## API route: `DELETE /api/market-insights/history`

New file `app/api/market-insights/history/route.ts`. Same shape as `app/api/market-insights/capture/route.ts`:
- `validateSameOriginRequest` (CSRF) → 403 on failure.
- `getOrCreateCurrentUser(request)` — this route only needs the local session (for `userId` scoping), not an eBay access token, since it's a pure local-DB operation with no eBay API call involved.
- Body: `{ itemIds: unknown }`, parsed and bounded the same way `capture/route.ts` parses its `items` array (cap array length, bound each string's length) — reusing that route's existing `boundedString`-style validation rather than inventing new rules.
- Calls `deleteMarketPriceRecords(userId, itemIds)`, returns `{ deletedCount }`.

## UI

### Per-item delete

`AnalyticsRow` gains an `onDelete: () => void` prop and a `deleting: boolean` prop (mirroring `onCapture`/`capturing`). A "Remove from history" button appears in `card-actions` alongside (not replacing) the existing "Add to history" button's slot — shown only when `item.captured && item.list === "WatchList"` (the same condition that already distinguishes a real captured record from a `WonList`-only row, which is what `isWonOnly` already checks).

```tsx
{item.captured && !isWonOnly && (
  <button
    className="secondary-button compact danger-action"
    disabled={deleting}
    onClick={(event) => {
      event.stopPropagation();
      if (window.confirm(`Remove "${item.title}" from price history? This can't be undone.`)) {
        onDelete();
      }
    }}
    type="button"
  >
    <Trash2 size={16} />
    <span>{deleting ? "Removing..." : "Remove from history"}</span>
  </button>
)}
```

### Bulk delete

A "Delete all visible" button next to "Capture all visible" in `Analytics`'s render, enabled whenever `filteredItems` contains at least one deletable item (`item.captured && item.list === "WatchList"`):

```ts
async function deleteAllVisible() {
  const deletable = filteredItems.filter((item) => item.captured && item.list === "WatchList");
  if (deletable.length === 0) {
    return;
  }
  if (!window.confirm(`Remove ${deletable.length} item${deletable.length === 1 ? "" : "s"} from price history? This can't be undone.`)) {
    return;
  }

  setBulkDeleting(true);
  try {
    const response = await fetch("/api/market-insights/history", {
      body: JSON.stringify({ itemIds: deletable.map((item) => item.itemId) }),
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      method: "DELETE"
    });
    if (!response.ok) {
      setMessage("Could not remove items from price history");
      return;
    }
    onItemsRemoved(deletable.map((item) => item.itemId));
  } finally {
    setBulkDeleting(false);
  }
}
```

### State update after delete

`Analytics` already receives `onItemsCaptured` from its parent to reconcile local state after a capture; it gains a matching `onItemsRemoved: (itemIds: string[]) => void`, implemented in the parent alongside the existing `markItemsCaptured`:

```ts
function removeHistoryItems(itemIds: string[]) {
  setHistoryState((current) => {
    if (current.status !== "ready") {
      return current;
    }
    const idSet = new Set(itemIds);
    return {
      ...current,
      history: {
        ...current.history,
        endedWatchlistItems: current.history.endedWatchlistItems.filter((item) => !idSet.has(item.itemId))
      }
    };
  });
}
```

This filters the removed items out of local state immediately, same pattern `markItemsCaptured` already uses for updating in place after a mutation — no full `refreshBuyingHistory()` round-trip needed for either action, single or bulk.

## Why this shape

- **Only `MarketPriceRecord`, never `WonItem`**: `WonItem` rows represent actual purchases (real money spent, imported from eBay's own order history) — deleting them would misrepresent a real transaction history, not just opt out of price tracking. The existing `isWonOnly`/`item.list === "WonList"` check already available on every `AnalyticsItem` is what gates this correctly, with no new data model needed.
- **`deleteMany` with a `userId` filter, not a loop of individual deletes**: matches the existing `captureMarketPriceRecords`'s `$transaction` batching style — one round-trip regardless of how many items are being removed, and the `userId` scoping is enforced at the query level rather than relying on the caller to have already filtered correctly.
- **Confirmation via native `confirm()`**: this codebase has no existing modal/dialog component to reuse, and introducing one for a single confirmation prompt would be disproportionate. `confirm()` is blocking and unstyled, but this is a personal single-user app, not a polished multi-tenant product — good enough for a genuinely destructive, no-undo action.
- **Local state reconciliation, not a full refetch**: `endedWatchlistItems` is exactly the array both delete paths need to filter — cheaper and more predictable than re-fetching the whole buying-history payload just to remove a couple of rows.

## Testing

- Unit/integration tests for `deleteMarketPriceRecords`: deletes only the specified IDs, scoped to the given user (a same-`venueItemId` row belonging to a different user is untouched), returns an accurate `deletedCount`, no-ops cleanly on an empty ID list or no persistence configured.
- Manual confirmation: on the Analytics tab, delete a single captured item and confirm it disappears immediately; use search/filters to narrow the visible list, bulk-delete, and confirm only the visible+deletable subset was removed and the count in the confirmation prompt was accurate. Both verified directly against the database (row genuinely gone, total count reduced by exactly the expected amount), not just by trusting the UI.

### A finding during manual testing: silent failure on a network error

An early bulk-delete test appeared to do nothing — the confirmation dialog showed and was accepted, but no error message appeared and the item wasn't removed. Root cause: the dev server had been torn down between sessions, so the `fetch()` call itself failed (connection refused) before ever reaching the `!response.ok` check — `deleteHistoryItems` had no `try/catch` around the fetch call, so the failure surfaced nowhere. Not a logic bug in the delete flow itself, but a real gap: any genuine network hiccup (not just a torn-down dev server) would have failed the same way, silently. Fixed by wrapping the fetch call in a `try/catch` and showing a message on failure, same as the existing `!response.ok` path already does.
