# Tasks: Fix GetOrders rejecting the raised watchlist page size

- [x] Create OpenSpec change documenting the regression and fix.
- [x] Cap `GetOrders`'s `entriesPerPage` independently of the shared watchlist value in `src/ebay/live-history-source.ts`.
- [x] Add a regression test proving the cap applies only to `GetOrders`.
- [x] Run OpenSpec validation, unit tests, build.
- [x] Manual functional test against Production eBay before requesting sign-off — confirm the warning is gone.
- [x] Run dual security review (security-review skill + Copilot CLI) after sign-off, then ship via PR.
