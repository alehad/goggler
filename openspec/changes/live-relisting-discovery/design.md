# Design: Live Relisting Discovery

## Record-ID Matching

The built-in generic record-ID matcher should support:

- one to five letters
- an optional hyphen
- one to six digits
- no spaces between the alphabetic and numeric portions

The default criteria should become `\b[A-Z]{1,5}-?\d{1,6}\b`. Normalization should continue stripping hyphens and whitespace so equivalent catalogue forms produce one group key.

Older saved defaults should migrate to the new default when they exactly match a previous built-in default.

## Live Relisting Search

The live eBay history source already fetches:

- current watchlist items
- lost buying-history items
- won buying-history items

After those lists are normalized, the source should identify unresolved lost groups by excluding any lost group that appears in won history. For each unique unresolved lost record ID, the server should run an eBay Browse search with that record ID as the query. When the source lost item has an eBay category ID, that category should be passed to Browse as a `category_ids` constraint so unrelated categories are filtered before ranking.

Returned Browse rows should become relisting candidates only when:

- the result has a price and item ID
- the result's relisting group matches the lost item's relisting group
- the result's eBay category matches the source lost item's category when the lost item has a category ID
- the record ID was derived from configured or built-in criteria, not exact-title fallback

If the source lost item has no category metadata, goggler should apply a conservative vinyl/record category fallback before showing a candidate. This avoids showing obvious false positives such as toys or decals that happen to include the same catalogue-looking code in the listing title.

The Home feed already suppresses separate needs-action rows for groups that are present on the watchlist, so the live candidate list can include matches that are already watched. They will still be represented by the watchlist-first rows.

Browse `buyingOptions` should be normalized into visible feed tags so relisting candidates can be distinguished as auctions or buy-now listings without opening eBay.

## Limits and Failure Handling

Relisting discovery should deduplicate record IDs and cap the number searched per refresh to avoid excessive Browse calls. If Browse relisting discovery fails after the buying-history lists have loaded, the history response should still render the watchlist/lost/won data and include a warning rather than failing the full refresh.
