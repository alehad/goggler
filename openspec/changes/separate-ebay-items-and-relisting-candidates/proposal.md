## Why

Home currently treats directly imported eBay items and goggler-discovered relisting candidates as one blended feed. That makes filters such as `Never won` ambiguous because a live candidate can inherit context from a lost bid even though the user never bid on that live listing.

The app needs a firmer model boundary: one list for items sourced directly from eBay account/history data, and one separate list for derived relisting candidates found by matching live listings against never-won history.

## What Changes

- Model Home feed rows with an explicit list origin: eBay-sourced rows vs relisting-candidate rows.
- Expose separate `ebayRows` and `relistingRows` collections in the Home feed response while retaining a composed `rows` list for rendering.
- Treat watchlist, won, lost, never-won, and resolved views as eBay-sourced history/watchlist views.
- Treat the Relistings view as a relisting-candidate view for items goggler may add to the watchlist.
- Keep tags and match signals on both lists, but stop using tags alone as the model boundary.

## Out Of Scope

- Persisting either list in a database.
- Changing eBay API retrieval strategy.
- Adding manual candidate acceptance or dismissal persistence.
