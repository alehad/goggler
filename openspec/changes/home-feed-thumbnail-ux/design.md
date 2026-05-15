# Design: Home feed thumbnail UX

## Data

The app already parses safe `GalleryURL` values from eBay Trading API responses. The Home feed builder should continue to pass through `imageUrl` for every row that originates from an item with an image, including:

- current watchlist rows
- relisting candidates that are not on the watchlist
- unresolved lost-bid rows
- resolved/eventually-won rows

Fixture data should mirror this by adding image URLs to lost and won fixtures, so local UX testing exercises the same visual density as live data.

## UI

The Home feed card thumbnail should become a primary visual anchor:

- increase from the current small icon-like thumbnail to a larger listing image
- preserve stable dimensions and avoid layout jumps
- use object-fit cover so eBay gallery images fill the frame cleanly
- reduce Home feed item title and metadata typography slightly
- keep compact action controls unchanged

The Home summary/filter surface should stay focused on the core auction-tracking questions. `Won` and `Never won` should be promoted into the summary metrics, with `Won` placed before `Never won`. The visible filter set should avoid lower-value `Needs action` and `Resolved` options.

Home should default to the current eBay watchlist because that is the most immediate active context. Won items should still be available from Home through a dedicated filter when eBay returns `WonList` history.

Refresh should not replace already loaded history with an empty/error state when a live eBay request fails transiently. If a refresh receives a server-side live-history failure after data is already displayed, the app should keep the previous feed visible.

## Safety

No new image trust boundary should be introduced. Existing eBay image URL sanitization remains the source of truth for live data. The browser should continue loading listing thumbnails with `referrerPolicy="no-referrer"`.
