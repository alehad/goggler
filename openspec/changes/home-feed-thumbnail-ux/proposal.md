# Change: Home feed thumbnail UX

## Why

The Home feed is easier to scan when listing thumbnails are available consistently, not only for items that are currently on the eBay watchlist. Lost bids, relisting candidates, and won items can all carry eBay gallery images, and the UI should use them when available.

The current thumbnails are also too small for visual comparison. Increasing thumbnail size while slightly reducing item text size should make the feed feel closer to an eBay-style listing surface.

## What Changes

- Preserve parsed eBay listing image URLs for all Home feed item types when the source data includes them.
- Ensure fixture data includes representative image URLs beyond the current watchlist subset.
- Increase Home feed thumbnail size to roughly twice the current visual footprint.
- Slightly reduce Home feed item title/body text so the larger images do not make cards feel crowded.
- Simplify Home feed filters by removing `Needs action` and `Resolved`.
- Replace the Home summary `Needs action` metric with `Won` and `Never won` metrics.
- Add won items to the Home feed when eBay buying history provides them.
- Default the Home feed filter to `On watchlist`.
- Keep existing image URL safety checks and no-referrer browser behavior.

## Out Of Scope

- Fetching images from a new eBay endpoint if the existing buying-history response does not provide one.
- Persisting image URLs outside the current response/session.
- Changing matching logic or feed ordering.
