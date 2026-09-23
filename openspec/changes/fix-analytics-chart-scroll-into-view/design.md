# Design: Scroll the Analytics chart into view when an item is selected

## The fix

`PurchaseChart` (`app/page.tsx:1247`) is a shared component — used by both the Purchases tab (with `onSelect`, so its points are clickable) and the Analytics tab (without `onSelect`, so it's display-only there). Its root element is a `<section className="purchase-chart-panel" ...>`. Give it an optional `id` prop, and pass a stable id only from the Analytics call site:

```tsx
function PurchaseChart({
  id,
  emptyLabel = "No dated purchases to chart",
  points,
  subtitle,
  title = "Purchase prices over time",
  selectedItemId,
  onSelect
}: {
  id?: string;
  // ...existing props
}) {
  // ...
  return (
    <section className="purchase-chart-panel" id={id} aria-label="Purchase prices over time">
```

Analytics call site (`app/page.tsx:1881-1894`):

```tsx
<PurchaseChart
  id="analytics-chart-panel"
  emptyLabel={...}
  points={chartPoints}
  subtitle={...}
  title="Matched sales over time"
/>
```

Retarget the existing effect at `app/page.tsx:1586-1595` (currently scrolling the selected row into view — a no-op in Analytics today, since selection there always originates from a row click, and the chart has no `onSelect` here to select from):

```tsx
useEffect(() => {
  if (!selectedItemId) {
    return;
  }

  document.getElementById("analytics-chart-panel")?.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}, [selectedItemId]);
```

`block: "start"` (rather than `"center"`, which the row-scroll effect used) puts the chart at the top of the viewport, matching "chart should appear at the top of the page" — the small amount of page content above it (the "Analytics" heading and the three summary metric cards) stays visible above the chart, which is fine; the point is getting the chart on-screen without the user scrolling, not literally zeroing the scroll position.

The Purchases tab's own scroll-to-card effect (`app/page.tsx:1134-1142`) is untouched — it solves the opposite problem (chart click → reveal the corresponding card) and stays correct as-is.

## Why not just remove the old effect without replacing it

Leaving no scroll behavior at all would still be a regression from the user's ask — the point isn't "stop doing the wrong thing," it's "do the right thing": bring the chart, not the row, into view. The row never needed scrolling into view in the first place (it's what the user just clicked), so this is a straight retarget, not two separate changes.

## Testing

This is a pure client-side scroll-behavior change with no server or persisted-data component, so it doesn't fit this repo's unit/integration test shape (same precedent as `fix-analytics-filter-row-layout`). Verified manually against the real Analytics tab (requires an eBay session, so this is a manual-confirmation-only change, same as the filter-row layout fix): select an item several screens down the list, confirm the chart scrolls into view at the top of the viewport with no manual scrolling needed, and confirm the Purchases tab's chart-click-to-scroll-to-card behavior is unaffected.
