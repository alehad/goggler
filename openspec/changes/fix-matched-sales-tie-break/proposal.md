# Change: Fix highest/lowest picking the wrong item on a price tie

## Why

Two TBM63 listings in the DB are genuinely tied at $103.50 — one ended 2026-05-24, the other 2026-07-12. The Analytics "Highest" summary card showed the 2026-05-24 sale, not the 2026-07-12 one the user expected. Root cause: `summarizeMatchedSales` (`src/market-insights/price-history.ts`) reduces over sales sorted oldest-first using strict `>`/`<` comparisons. On a tie, the first-encountered (i.e. oldest) item silently wins, since a later equal-priced item never satisfies the strict inequality needed to replace it. This is order-dependent, unintended behavior, not a deliberate choice.

## What Changes

- `summarizeMatchedSales`'s `lowest`/`highest` reduction changes from strict `>`/`<` to `>=`/`<=`. Since the input is sorted oldest-first, this makes a later (more recent) equal-priced sale win a tie over an earlier one — matching the natural expectation that "the highest/lowest sale" is a specific, most-relevant instance, not whichever happened to come first in sort order.

## Out Of Scope

- Any change to how sales are matched into a relisting group, or how many items the chart/list shows — those are working correctly and unrelated to this bug.

## Success Criteria

- When multiple sales in a group tie for highest (or lowest) price, the summary card shows the most recent one.
- Non-tied cases are unaffected (unique highest/lowest still shown correctly).
