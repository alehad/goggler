# Tasks: Fix silent watchlist truncation dropping ended items

- [x] Create OpenSpec change documenting the bug and fix.
- [x] Get user sign-off to proceed.
- [x] Raise `entriesPerPage`/`maxPages` defaults in `fetchLiveEbayHistoryResponse` (`src/ebay/live-history-source.ts`).
- [x] Add `warnings?: string[]` to the client `BuyingHistory` type in `app/page.tsx`; render a warning banner on the Dashboard tab when present.
- [x] Run OpenSpec validation, unit tests, build.
- [x] Manual functional test against Production eBay before requesting sign-off — confirm all 4 TBM63 items now show.
- [x] Run dual security review (security-review skill + Copilot CLI) after sign-off, then ship via PR.
