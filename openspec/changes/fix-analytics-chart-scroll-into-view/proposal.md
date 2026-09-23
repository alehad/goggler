# Change: Scroll the Analytics chart into view when an item is selected

## Why

The Analytics tab's matched-sales chart renders once, near the top of the page (above the search box and item list), and updates in place to whichever item is currently selected. The item list itself can be long enough to need multiple screens of scrolling. When the user scrolls down and selects an item from far down the list, the chart updates correctly but is now off-screen above the viewport — the user has to manually scroll back up to see the result of their selection.

There's already a `useEffect` (`app/page.tsx:1586-1595`) that runs on every `selectedItemId` change and scrolls the corresponding row into view. In the Analytics tab specifically, selection only ever originates from clicking a row (the chart isn't click-selectable there — unlike the Purchases tab, `PurchaseChart` is rendered in Analytics without an `onSelect` prop), so that effect is currently scrolling an already-visible, just-clicked row into view — a no-op from the user's perspective. It's solving the wrong direction of the problem.

## What Changes

- The Analytics tab's chart panel (`PurchaseChart`, wrapped in `<section className="purchase-chart-panel">`) gets a stable DOM id.
- The existing `selectedItemId`-driven scroll effect, for the Analytics tab, is retargeted from the selected row to the chart panel — selecting any item scrolls the chart to the top of the viewport (`scrollIntoView({ block: "start" })`), so the updated chart is immediately visible without the user needing to scroll back up manually.
- No change to the Purchases tab's own, separate scroll-to-row effect (`app/page.tsx:1134-1142`) — that one exists for the opposite, still-valid reason: Purchases' chart points *are* click-selectable, so scrolling the corresponding purchase card into view after a chart click is the right behavior there and is unaffected by this change.

## Out of Scope

- Making the Analytics chart's own data points click-to-select (it isn't today, and nothing about this fix requires it).
- Any change to what the chart shows once selected — only when/whether the page scrolls to reveal it.

## Success Criteria

- Selecting any item from anywhere in the Analytics item list — including one several screens down — brings the updated chart into view at the top of the viewport, without the user manually scrolling.
- The Purchases tab's existing chart-click → scroll-to-card behavior is unchanged.
