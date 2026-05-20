## Why

The current default matching criteria are too narrow because they only recognize `TBM` and `PAP` catalogue identifiers. Record identifiers across labels are usually an alphabetic prefix followed immediately by digits, and goggler should capture those identifiers generically so lost bids, watchlist rows, eventual wins, and selected purchase market-history lookups can match more complete collections.

## What Changes

- Replace the default criteria with a generic record-ID pattern:
  - up to five leading letters
  - followed immediately by up to six digits
  - no spaces or separators within the identifier
- Keep user-editable semicolon-separated criteria in My goggler.
- Preserve exact-title fallback when enabled.
- Use the same generic catalogue-ID extraction for selected purchase market-history searches.

## Out Of Scope

- Persistent storage for matching preferences.
- Label-specific metadata fields from eBay.
- Fuzzy title matching beyond exact title and catalogue-ID criteria.
