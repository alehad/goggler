# Change: Fix price-history capture silently dropping valid items

## Why

A user captured 4 ended-watchlist items sharing a relisting group ("ISAO SUZUKI TRIO BLACK ORPHEUS THREE BLIND MICE TBM63 1LP") via "Capture all visible" but only 2 ended up in the database.

Item identity is keyed by eBay's real unique `itemId` (never by title/date), so this isn't a same-date collision. The actual cause: `captureItems` independently re-derives the user's **entire** ended-watchlist by re-calling eBay's paginated `GetMyeBayBuying` (Trading API) at capture time, and only persists requested ids that are still present in that fresh, paginated re-fetch. That whole-list re-derivation is the thing that's unreliable — pagination windows can shift, and relisting-driven watchlist churn (exactly what this app exists to track) can drop entries between the Analytics tab loading and the user clicking capture — silently discarding otherwise-valid items into an internal `skipped` list the UI never showed.

## What Changes

- `captureItems` no longer re-derives the whole watchlist via the Trading API. It takes the item data already shown to the user (title, seller, condition, end time, etc. — everything the Analytics tab already has from its own load) directly from the client request.
- The one thing it still never trusts from the client is **price**: for each requested item, it independently looks up that item's current native price via a single targeted eBay Browse API call (`fetchEbayItemNativePrice`, keyed by that item's own `itemId`) — the same mechanism already used to resolve native (non-marketplace-converted) prices elsewhere in this app. If that lookup fails for a given item, it is skipped (not captured with an unverified price).
- This removes the pagination/relisting-churn failure mode entirely, since there's no longer a "still present in a fresh paginated list" check — just "does eBay confirm a price for this exact item id."
- As a side effect, this capture route no longer needs the user's own eBay OAuth session (it never calls the user-scoped Trading API), only the app's own Browse API credentials — so capturing already-loaded items keeps working even if the eBay session has expired since the page loaded.
- The Analytics tab surfaces any still-skipped items (price lookup failed) in a message, instead of no feedback at all.

## Out Of Scope

- `categoryId`/`categoryName` on captured records: the client's item type doesn't carry these fields today (they were only ever populated from the Trading API watchlist re-fetch this change removes). They'll be empty on newly-captured records going forward — not used anywhere in the UI today, so treated as an acceptable minor loss rather than a blocker. Can be revisited later if needed.
- Any change to how items are matched/grouped for the Analytics list, deduplicated for storage, or displayed — confirmed not the cause of the original report.

## Success Criteria

- Capturing items already visible on the Analytics tab persists all of them, as long as each one's price can still be independently resolved from eBay — no more drops caused by watchlist pagination/relisting churn.
- The captured price is still always independently verified against eBay at capture time, never trusted verbatim from the client.
- If a price lookup does fail for some item, the user sees which item(s) and can retry, instead of silent partial success.
