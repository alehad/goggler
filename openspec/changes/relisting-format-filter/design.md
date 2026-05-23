# Design: Relisting Format Filter

Home already models listing format as `Auction` and `Buy now` row tags derived from eBay Browse `buyingOptions`.

The UI should introduce a local-only `relistingFormatFilter` state with three values:

- `both`
- `auction`
- `buyNow`

When the main Home filter is `relistings`, rows should first be filtered to relisting candidates, then narrowed by `relistingFormatFilter`:

- `both`: no additional filtering
- `auction`: rows tagged `Auction`
- `buyNow`: rows tagged `Buy now`

The control should render in a right-aligned toolbar immediately below the main Home filters and above the candidate list. It should not render for Search, Watchlist, Won, Never won, or All views. The selected value can remain in component state when leaving Relistings, but it must not affect other views.
