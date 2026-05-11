# Tasks: Home relisting watchlist UX

## 1. Planning

- [x] Create OpenSpec change for unified Home relisting/watchlist UX.
- [x] Define Home feed inputs, tags, filters, and actions.
- [x] Define current eBay watchlist items as the first Home section, preserving eBay watchlist order.
- [x] Document fixture-backed scope and live eBay watchlist open questions.

## 2. Fixture Data Planning

- [x] Define active eBay watchlist fixture shape.
- [x] Include explicit watchlist display order in fixture data.
- [x] Define relisting candidate fixture shape.
- [x] Model candidates that are already watched and candidates that are not watched.
- [x] Model unrelated watchlist items separately from watchlist items tied to lost bids.

## 3. Home UX Implementation

- [x] Replace static Home candidate cards with unified fixture-backed feed data.
- [x] Add Home status filters for needs action, on watchlist, relistings, never won, and resolved.
- [x] Add row tags for lost bid, relisting candidate, on watchlist, and decision status.
- [x] Add fixture-only Add to watchlist behavior that does not call eBay.
- [ ] Add confirm/dismiss fixture-only row actions.

## 4. Verification

- [x] Add unit tests for fixture feed construction and filter counts.
- [x] Run unit tests.
- [x] Run TypeScript check.
- [x] Run advisory security review if implementation changes API/auth behavior.
- [ ] Manually inspect Home on desktop and mobile-width layouts.
