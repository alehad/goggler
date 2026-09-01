# Design: macOS Analytics tab

## Model additions

`HistoryItem` gains `captured: Bool?` (`GogglerModels.swift`) — present only in `endedWatchlistItems`' JSON, absent (decodes as `nil`) on `lostItems`/`wonItems`, matching the TS type's structural distinction (`EndedWatchlistItem = HistoryItem & { captured: boolean }`) without needing a parallel Swift struct. `HistoryItem`'s stored properties become `var` (harmless for `Decodable`) so `markCaptured` can produce updated copies in place.

`BuyingHistory` gains `endedWatchlistItems: [HistoryItem]`.

Two small response types for the new calls:

```swift
struct CaptureResult: Decodable, Sendable {
    let captured: [String]
    let skipped: [String]
}

struct DeleteResult: Decodable, Sendable {
    let deletedCount: Int
}
```

## `BuyingHistoryStore` additions

```swift
func captureItems(_ items: [HistoryItem], using client: GogglerAPIClient) async -> CaptureResult? {
    do {
        let body: [String: Sendable] = ["items": items.map(captureRequestBody)]
        let (result, _) = try await client.requestDecoded("/api/market-insights/capture", as: CaptureResult.self, method: "POST", jsonBody: body)
        markCaptured(result.captured)
        return result
    } catch {
        AppLog.network.error("captureItems failed — \(...)")
        return nil
    }
}

func deleteItems(_ itemIds: [String], using client: GogglerAPIClient) async -> Bool {
    do {
        let raw = try await client.request("/api/market-insights/history", method: "DELETE", jsonBody: ["itemIds": itemIds])
        guard (200..<300).contains(raw.statusCode) else { return false }
        removeItems(itemIds)
        return true
    } catch {
        return false
    }
}

private func markCaptured(_ itemIds: [String]) {
    guard case .ready(var history) = buyingHistoryState else { return }
    let idSet = Set(itemIds)
    history.endedWatchlistItems = history.endedWatchlistItems.map { item in
        var updated = item
        if idSet.contains(item.itemId) { updated.captured = true }
        return updated
    }
    buyingHistoryState = .ready(history)
}

private func removeItems(_ itemIds: [String]) {
    guard case .ready(var history) = buyingHistoryState else { return }
    let idSet = Set(itemIds)
    history.endedWatchlistItems = history.endedWatchlistItems.filter { !idSet.contains($0.itemId) }
    buyingHistoryState = .ready(history)
}
```

`captureRequestBody(_:)` builds the same shape `toCaptureRequestItem` sends on the web (`itemId`, `title`, `list`, `endTime`, `sellerUserId`, `conditionDisplayName`, `imageUrl`, `itemWebUrl`) — every field already on `HistoryItem`, no new data needed.

`markCaptured`/`removeItems` are private — `AnalyticsView` only ever calls the two public async methods, matching the pattern already established (views never reach into the store's internal state machine directly).

## `AnalyticsView`

- Computed `analyticsItems`: mirrors `app/page.tsx`'s `items` `useMemo` — `endedWatchlistItems` mapped with `won`/`eventuallyWon` derived from `wonItems`, plus any `wonItems` not already in that list (won-only rows), sorted by `endTime` descending.
- Two `Picker(.segmented)` filters (capture status, win status) + search `TextField`, exactly the shape already established in `WatchlistView`/`PurchasesView`.
- `AnalyticsRow`: `RecordThumbnail`, title/seller/date, captured/won/eventually-won status pills, price, and the capture/delete button for that row (only one shown at a time, matching the web app's `!item.captured`/`item.captured` mutual exclusivity — `WonList`-only rows get neither, matching `!isWonOnly` in the web version).
- Bulk actions in the filter row: "Capture all visible" (enabled when any visible item is capturable) and "Delete all visible" (enabled when any visible item is capturable-and-captured), each disabled mid-flight and showing a progress state, matching `bulkCapturing`/`bulkDeleting` on the web.
- Delete (both per-item and bulk) goes through `.confirmationDialog(...)` before calling the store — SwiftUI's native equivalent of `window.confirm`, same "can't be undone" copy.

## Testing

- `BuyingHistoryStore` capture/delete: new unit tests using the same `MockURLProtocol` pattern already established — capture success updates `endedWatchlistItems`' `captured` flags in place; delete success removes the matching items; both leave state untouched on failure.
- `AnalyticsView`'s item-computation logic (won/eventuallyWon derivation, sort order, won-only dedup) is pure enough to unit test directly against a fixed `BuyingHistory` fixture, mirroring the web app's own `items` logic exactly — worth a dedicated test given how easy this specific computation is to get subtly wrong (it's the one part of this view with real branching logic, everything else is filter/search plumbing already proven correct in Watchlist/Purchases).
