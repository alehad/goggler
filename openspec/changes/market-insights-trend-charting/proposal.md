# Change: Market insights trend charting (stage 2)

## Why

Stage 1 (`market-insights-price-history-capture`) built the capture mechanism and left trend charts explicitly out of scope, deferring them until there was enough captured data to chart meaningfully. There are now 110 captured sales in `MarketPriceRecord`. This stage adds the actual analysis view: search the ended-items list, select an item, and see how "the same item" (by `relistingGroupId`) has sold over time, with your own purchase highlighted and summarized.

## What Changes

- Add a text search box to the Analytics tab that filters the ended-items list by title/seller, layered on top of the existing All/Captured/Not-captured filter.
- Move the chart to the top of the Analytics tab, above the item list. Selecting an item from the list drives the chart to show every captured sale sharing that item's `relistingGroupId`.
- Extend the `market-insights` module with a read path that, for a given `relistingGroupId` + currency, returns every matching `MarketPriceRecord` plus any of the user's own `WonItem` purchases for the same group — even ones that were never on the watchlist and so never became a captured record — merged into one set of chart points, each flagged `won: true`/`false`.
- Reuse and extend the existing `PurchaseChart` component (already built for the Won tab) with a `won` point flag rendered as a distinct highlight color, rather than building a parallel chart component.
- Add five summary cards for the selected item's matched sales: count, my price paid (+ date), average, lowest (+ date), highest (+ date).
- Currency handling: matched-sales data is scoped to the selected item's own currency. Sales of "the same" catalogue item in a different currency are not merged into the chart or stats for that selection, consistent with the app's existing no-blended-currency principle.

## Out Of Scope

- Any currency conversion — a different-currency sale of the same catalogue item is simply not included in a given selection's chart/stats, not converted into it.
- Changing the background re-watch job (still a separate, later, write-boundary-crossing stage).
- Multi-item comparison charts (overlaying more than one selected item's trend at once).
- Editing or deleting captured records (unchanged from stage 1).

## Success Criteria

- The search box narrows the ended-items list by text without requiring a new eBay fetch.
- Selecting an item shows a chart of every captured sale sharing its `relistingGroupId` and currency, above the list.
- Any plotted sale (or the user's own matching win, even if never captured) that the user actually won is visually distinguished from the rest.
- The five summary cards match the chart's data exactly (same filtered, same-currency set).
- No eBay write actions or new eBay API calls are introduced — this reads only from the local database.
