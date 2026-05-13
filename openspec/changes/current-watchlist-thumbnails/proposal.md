# Change: Current watchlist thumbnails

## Why

Production read-only testing showed that the Home watchlist filter can include items that were previously watched but are no longer live. The watchlist view should represent the user's current live eBay watchlist. The Home cards also show watchlist order numbers, but the item thumbnail is more useful for scanning.

## What Changes

- Filter live eBay WatchList rows to active listings before building the Home feed.
- Carry eBay thumbnail/gallery image URLs through the live history and Home feed contracts.
- Replace the watchlist order badge in Home cards with the item thumbnail when available.
- Keep a compact icon fallback when a listing has no image.

## Out Of Scope

- Persisting watchlist images or eBay listing data.
- Implementing image proxying or caching.
- Adding eBay watchlist write actions.
- Changing the non-watchlist filters beyond preserving their current behavior.

## Success Criteria

- The "On watchlist" filter only shows active live eBay WatchList items for live eBay data.
- Home feed cards display the listing thumbnail instead of a numeric watchlist rank when an image is available.
- Existing fixture and non-watchlist workflows continue to work.
