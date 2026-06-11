# Proposal: Show won date on won-item rows

## Why

Won-item rows currently show condition and seller but do not show when the item was won. The won timestamp is already available in the normalized history response and persisted won-item records, so displaying it gives useful purchase context without changing the data model.

## What Changes

- Show the date won alongside condition and seller metadata for won-item rows.
- Apply the same display behavior to won rows in the Home feed and the Purchases list.
- Format the value as a compact absolute date in the user's locale.
- Omit the date cleanly when no valid won timestamp is available.

## Out Of Scope

- Database or eBay API changes.
- Displaying times or time zones.
- Changing active-listing relative-time labels.
- Showing dates on lost, watchlist, search-result, or relisting-candidate rows.

## Success Criteria

- A won item with a valid timestamp shows `won: <date>` next to its condition and seller.
- Won dates appear consistently in Home and Purchases.
- Missing or invalid timestamps do not show broken or placeholder dates.
