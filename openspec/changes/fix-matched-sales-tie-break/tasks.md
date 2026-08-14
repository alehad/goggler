# Tasks: Fix highest/lowest picking the wrong item on a price tie

- [x] Create OpenSpec change documenting the bug and fix.
- [x] Change `summarizeMatchedSales`'s tie-break from strict `>`/`<` to `>=`/`<=` in `src/market-insights/price-history.ts`.
- [x] Add unit tests for tied highest/lowest cases.
- [x] Run OpenSpec validation, unit tests, build.
- [x] Manual functional test against Production eBay before requesting sign-off.
- [x] Run dual security review (security-review skill + Copilot CLI) after sign-off, then ship via PR.
