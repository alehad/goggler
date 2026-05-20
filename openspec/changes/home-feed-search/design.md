## Design

### Search State

Keep search state in the app shell because the search box lives in the top bar while the results render in the Home tab:

- `searchDraft`: current input text.
- `homeSearchQuery`: last executed query.

Submitting the search form should trim the draft, set `homeSearchQuery`, switch to the Home tab, and request live eBay search results through a goggler API route. Clearing the input should clear `homeSearchQuery`.

### Home Filter

Add a `search` Home filter tab immediately to the left of `onWatchlist`. When `homeSearchQuery` is set, Home should select the Search tab automatically. Users can switch back to On watchlist or any other filter without losing the search text.

### Live Search Route

Add a server route that:

- accepts same-origin POST requests only
- requires the current goggler/eBay session
- bounds the query length
- requests an eBay application token server-side
- calls eBay Browse `item_summary/search`
- includes auction listings using the `buyingOptions` filter
- normalizes returned listings into Home-compatible rows

The browser must never receive the eBay access token.

### Tagging

Live search results should be cross-tagged in the browser against currently loaded Home feed rows:

- `On eBay watchlist` when the live result appears to match a watchlist row
- `Relisting candidate` and `Never won` when the result shares a relisting group with an unresolved lost bid
- `Won` when it shares a relisting group with a won row

Matching should prefer shared eBay item URLs and relisting groups, then fall back to exact normalized titles.

### Empty State

If search mode has no live matching rows, show a compact empty panel that names the query and lets the user return to On watchlist.

### Security

The search query must be sent only to the goggler API route and must not be interpreted as a regex. eBay URLs from live search results must be sanitized before rendering.
