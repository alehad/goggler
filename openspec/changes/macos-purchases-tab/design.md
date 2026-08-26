# Design: macOS Purchases tab

## Shape

Directly mirrors `WatchlistView`'s structure (same file established in [[macos-watchlist-and-startup-check]]):

- `@Environment(BuyingHistoryStore.self)` for `wonItems` from `store.buyingHistoryState`'s `.ready(history)` case — no new store method, no new network call.
- A `TextField` search box filtering by `title`/`sellerUserId` (case-insensitive substring match, matching the web `Won` component's `toLocaleLowerCase("en-GB")` behavior).
- A `PurchaseRow` (mirrors web's `PurchaseCard`, minus the image and matched-sales badge): title, seller, "won: <date>", price paid.
- A count metric + Refresh button calling `store.refresh(using:)`, matching Watchlist's pattern exactly.
- Wired into `ContentView`'s `detailView` switch in place of `PlaceholderTabView(item: .purchases)`.

No new files needed in `Networking/` — `HistoryItem`/`Money` already carry every field this view needs (`title`, `sellerUserId`, `endTime`, `currentPrice`).

## Deferred work, and why

Chart, matched-sales comparison badges, and the Analytics cross-link are real, separately-scoped pieces of work (a second network call plus a `matchingPreferences` model that doesn't exist on macOS at all yet, and a whole Analytics tab to link into) — building them now would blow this past a single, reviewable increment for no functional gain over shipping the list first, exactly the reasoning already applied to Watchlist's capture/delete actions.
