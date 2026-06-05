# Capability: eBay Buying History

## ADDED Requirements

### Requirement: Lost bid and final price currency detail

The eBay buying-history model SHALL preserve separate money values for the user's maximum bid and the listing's current/final auction price when eBay returns both values.

#### Scenario: Lost auction includes max bid and final price

- **GIVEN** eBay returns a `LostList` item with `BiddingDetails.MaxBid` and `SellingStatus.CurrentPrice`
- **WHEN** goggler normalizes the row
- **THEN** the row SHALL expose `maxBid` from `BiddingDetails.MaxBid`
- **AND** it SHALL expose `currentPrice` from `SellingStatus.CurrentPrice`
- **AND** each value SHALL preserve its own returned currency code

#### Scenario: Lost auction lacks max bid

- **GIVEN** eBay returns a `LostList` item with `SellingStatus.CurrentPrice`
- **AND** eBay does not return `BiddingDetails.MaxBid`
- **WHEN** goggler normalizes the row
- **THEN** the row SHALL expose the final/current price
- **AND** it SHALL NOT infer a maximum bid
