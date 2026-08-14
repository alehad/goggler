# Change: Fix Analytics captured status resetting on tab switch

## Why

After using "Capture all visible" (or capturing a single item) on the Analytics tab, captured items showed as "Not captured" and became eligible for "Add to history" again as soon as you switched to another tab and back. Confirmed with a real item: "Takashi Mizuhashi ~ Who Cares TBM TBM-31 Japan autograph(Otomo Yoshio) LP" stayed captured in the database (the `MarketPriceRecord` row is real and persisted) but the UI forgot about it.

## Root Cause

The Analytics tab tracked freshly-captured item ids in a `locallyCapturedIds` state local to the `Analytics` component. Because `Analytics` is conditionally rendered (`{activeTab === "analytics" && <Analytics ... />}`), navigating to another tab unmounts it and discards that state. The underlying `historyState.history.endedWatchlistItems[i].captured` flag — the actual source of truth read from the database — is only ever refreshed by a full live eBay re-fetch (`refreshBuyingHistory()`), which capturing does not trigger. So on remount, the Analytics list fell back to the stale pre-capture `captured: false`.

## What Changes

- Move the captured-status update out of `Analytics`-local state and into a `markItemsCaptured(itemIds)` helper on the `Home` component that patches `historyState.history.endedWatchlistItems` in place, the same shared state the whole app already reads from.
- `Analytics` now calls this via a new `onItemsCaptured` prop after a successful capture, instead of maintaining its own parallel `locallyCapturedIds` list.
- This survives tab switches because `historyState` lives in `Home`, not in the unmounted `Analytics` component, and it avoids triggering an unnecessary slow (~20s+) full eBay re-fetch just to reflect a capture that already succeeded.

## Out Of Scope

- Any change to the capture API route or persistence layer — the bug was purely in client-side state placement; the database was always correct.

## Success Criteria

- After capturing an item (single or "Capture all visible") on the Analytics tab, switching to another tab and back still shows it as "Captured".
