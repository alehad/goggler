# Design: Fix highest/lowest picking the wrong item on a price tie

## Change

`src/market-insights/price-history.ts`:

```diff
-  const lowest = sales.reduce((lowest, sale) => (sale.price.value < lowest.price.value ? sale : lowest));
-  const highest = sales.reduce((highest, sale) => (sale.price.value > highest.price.value ? sale : highest));
+  const lowest = sales.reduce((lowest, sale) => (sale.price.value <= lowest.price.value ? sale : lowest));
+  const highest = sales.reduce((highest, sale) => (sale.price.value >= highest.price.value ? sale : highest));
```

`listMatchedSales` (the only caller of `summarizeMatchedSales` with real data) already sorts its input ascending by `endedAt` before this runs, so `<=`/`>=` deterministically prefers the most recent sale on a tie, rather than depending on array order incidentally matching sort order.

## Testing

- New unit test for `summarizeMatchedSales`: two sales tied at the same (highest) price with different dates — assert the more recent one is returned as `highest`. Same for a tied `lowest`.
- Existing non-tied test cases continue to pass unchanged (verifies no behavior change for the unique-min/max case).
