# Proposal: macOS Purchases tab

## Why

Home and Watchlist ([[macos-app-shell]], [[macos-watchlist-and-startup-check]]) are done; Purchases is next per the original phased plan. The web app's "Won item history" tab (`Won` in `app/page.tsx`) is meaningfully bigger than Watchlist was, though: it draws a hand-rolled SVG price-over-time chart, fetches a separate matched-sales-summary comparison per item (a second network call, `/api/market-insights/matched-sales/summary`) to show "paid vs. average" badges, and links into the Analytics tab for a detailed price history view — none of which exist on macOS yet.

## What Changes

- New `PurchasesView` tab: search (title/seller), a purchase card list (title, seller, won date, price paid — everything already present on the shared `BuyingHistoryStore`'s `wonItems`, no new backend call), a count, and a Refresh action — the same shape and scope Watchlist shipped at.
- Wired into `ContentView`'s `detailView` switch, replacing the Purchases placeholder.

## Out of Scope (deferred, matching how Watchlist and Home were phased)

- The price-over-time chart (`PurchaseChart`) — a real, separate piece of work; candidate for `Swift Charts` once this list ships.
- The matched-sales-summary "paid vs. average" comparison badge — needs its own network call and decoding, and depends on `matchingPreferences` (not yet modeled on macOS at all).
- "View price history" cross-link into Analytics — Analytics doesn't exist on macOS yet.
- Item thumbnail images — Home/Watchlist didn't render them either; staying consistent for now.

## Success Criteria

- Selecting Purchases in the sidebar shows real won items from the same buying-history load Home/Watchlist already trigger — no second network round-trip.
- Search filters by title or seller, matching the web app's behavior.
- No changes to `src/`, `app/api/*`, or `app/page.tsx`.
