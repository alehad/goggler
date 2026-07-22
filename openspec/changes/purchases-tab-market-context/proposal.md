# Change: Purchases tab market context

## Why

The Purchases (Won) tab currently just lists what you paid, with no sense of whether that was a good price. Meanwhile the Analytics tab already computes exactly this — average/lowest/highest matched-sale prices per relisting group — but only for items reachable from the ended-watchlist list, and only one at a time. This change surfaces that same market context directly on each purchase, and wires the two tabs together so a purchase can jump straight to its own price-history chart.

## What Changes

- Add the same text search box used on the Analytics tab to the Purchases tab, filtering the purchase list by title/seller.
- Add per-item market-context stats to each purchase card: average price, min price, max price, and diff vs average (both absolute and percentage), right-aligned to the right of the existing "price paid" block. Diff is green when you paid less than average, red when you paid more.
- Rewire the rightmost icon button on each purchase card (currently "View on eBay") to instead switch to the Analytics tab with that purchase selected and highlighted, showing its price-history chart. The external eBay link is dropped, not kept as a second action.
- Extend the Analytics tab's item list to also include Won items that were never on the watchlist (and so never appeared in the ended-watchlist list), fully date-interleaved with ended-watchlist items.
- Tag every Analytics row with its capture status (captured/not captured) and win status (won/eventually won/never won), shown as badges, and add a second segmented filter for win status alongside the existing capture-status filter, combined with AND.

## Out Of Scope

- Currency conversion — stats and diffs are computed only within a purchase's own currency, same principle as the existing Analytics matched-sales work.
- Any new eBay API calls or writes — this is entirely a read/UI change over already-fetched and already-persisted data.

## Success Criteria

- Typing in the Purchases tab search box narrows the purchase list by title/seller without a new eBay fetch.
- Every purchase card shows average/min/max and a colored diff-vs-average, computed from the same matched-sales data the Analytics tab already uses for that item's relisting group and currency.
- Clicking the rightmost action on a purchase card switches to the Analytics tab with that item selected, scrolled into view, and its price-history chart populated.
- A purchase that was never on the watchlist (so never in the ended-watchlist list) is still selectable and shows correctly in the Analytics tab.
