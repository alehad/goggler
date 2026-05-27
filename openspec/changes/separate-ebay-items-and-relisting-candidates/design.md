# Design: Separate eBay Items and Relisting Candidates

## Model Boundary

Home feed rows should carry a `modelList` field:

- `ebay`: rows sourced directly from eBay account/history lists
- `relisting_candidate`: rows discovered by goggler through live relisting search
- `search`: ad hoc live search results

The Home feed response should expose:

- `ebayRows`: direct eBay rows for watchlist, won history, lost history, never-won history, and resolved lost history
- `relistingRows`: candidate rows derived from matching never-won records against live listings
- `rows`: composed display list for the current UI

This preserves the existing rendering path while giving filters and future features a stable model boundary.

## Filtering

Home filters should use model boundaries instead of only status tags:

- `On watchlist`: eBay rows in the watchlist section
- `Won`: eBay rows in the won section
- `Never won`: eBay rows in the unresolved section
- `Relistings`: relisting-candidate rows only, with the existing auction/buy-now refinement
- `All`: the composed display rows
- `Search`: search rows

Relisting candidates may still carry tags such as `Lost bid` or `Never won` as context, but those tags must not cause them to appear in the `Never won` eBay history view.

## Counts

Home feed counts should follow the same boundary:

- `watchlist`, `won`, `neverWon`, and `resolved` count eBay rows
- `needsAction` and `relistings` count relisting-candidate rows that are not already watched
- `watchlistRelistings` counts direct watchlist rows that match lost-bid history
