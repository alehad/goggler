## Why

goggler can now search live eBay listings manually, but Home still relies on fixture-mode or watchlist-only relisting candidates. The live source should actively look for relistings of records the user bid on and did not win, using the configured record-ID matcher rather than full-title matching.

The default record-ID matcher also needs to recognize common catalogue formats where the alphabetic prefix and numeric suffix are separated by a hyphen, such as `BNJ-71001`.

## What Changes

- Update the default generic record-ID matching criteria to allow an optional hyphen between the alphabetic prefix and numeric suffix.
- Keep normalizing matched record IDs without punctuation so `BNJ71001` and `BNJ-71001` share the same relisting group.
- During live buying-history import, derive record IDs from unresolved lost-bid items.
- Search live eBay listings for those record IDs using the existing Browse search path.
- Preserve eBay category metadata where the live history and Browse APIs provide it.
- Filter live relisting candidates to the same eBay category as the source lost bid when a lost category is available.
- Tag discovered relisting candidates as auction or buy-now listings based on Browse buying options.
- Add matching live listings as Home relisting candidates so they appear as actionable relistings when they are not already on the current watchlist.

## Out Of Scope

- Persisting discovered relisting candidates.
- Automatically adding relisted items to the eBay watchlist.
- Using fuzzy title matching when no configured record ID can be extracted.
