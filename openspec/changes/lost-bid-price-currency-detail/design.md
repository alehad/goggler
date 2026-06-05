# Design: Lost bid price currency detail

## Data Model

Extend the shared eBay buying-history item shape with an optional `maxBid` money value. The field should be populated from `BiddingDetails.MaxBid` when parsing Trading API `LostList` rows. It may also be present on fixture rows where useful for local UI testing.

`currentPrice` continues to represent `SellingStatus.CurrentPrice`. For ended auctions in `LostList`, this should be treated as the final auction price, not the user's bid.

## UI

Never-won / lost rows should show:

- `max bid <amount>` when `maxBid` is present.
- `sold for <amount>` when `currentPrice` is present.

When both are present, display them together in the row metadata so the user can compare their bid against the final price. The right-side price should use the same money formatter and label the amount as `sold for` for lost history rows.

Existing Home feed relisting candidates can continue to show `originalLostPrice` as a reference to the prior lost auction final price, but must use the returned currency rather than forcing GBP.

## API Notes

eBay Trading API `GetMyeBayBuying` documents:

- `LostList.Item.SellingStatus.CurrentPrice`: the current/final listing price in the original listing currency.
- `LostList.Item.BiddingDetails.MaxBid`: the buyer's highest bid when returned.

The implementation should not convert values or guess missing bids.
