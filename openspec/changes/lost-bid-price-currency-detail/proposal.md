# Change: Lost bid price currency detail

## Why

Never-won eBay history currently displays lost-list amounts with a GBP-only formatter in parts of the UI, even when the original auction was run in another currency. It also labels the lost-list `CurrentPrice` as a lost bid, which is misleading: eBay's Trading API defines `SellingStatus.CurrentPrice` as the listing's current/final auction price, while `BiddingDetails.MaxBid` is the buyer's highest bid when returned.

## What Changes

- Preserve and display the currency returned by eBay for lost-list prices.
- Parse `LostList.Item.BiddingDetails.MaxBid` as the user's highest bid when eBay returns it.
- Keep `SellingStatus.CurrentPrice` as the auction/listing price, labelled as sold/current price rather than lost bid.
- Show never-won rows with both values in one line when available: max bid and sold for.
- Fall back gracefully when max bid is absent.

## Out Of Scope

- Currency conversion.
- Inferring max bid when eBay does not return `BiddingDetails.MaxBid`.
- Changing won-item purchase analytics.
- Adding marketplace sold-history lookups.

## Success Criteria

- A lost auction run in USD displays USD, not GBP.
- A never-won row with both `MaxBid` and `CurrentPrice` shows both with clear labels.
- A lost row missing `MaxBid` still shows the sold/current price without implying it is the user's bid.
- Tests cover parsing lost-list `MaxBid` and preserving currencies.
