# Capability: UI Foundation

## ADDED Requirements

### Requirement: Never-won price labels

The UI SHALL label never-won auction prices according to what each money value represents.

#### Scenario: Never-won row has max bid and sold price

- **GIVEN** a never-won row has `maxBid` and `currentPrice`
- **WHEN** the row is displayed
- **THEN** the UI SHALL show the max bid as the user's bid
- **AND** it SHALL show the current/final price as sold for
- **AND** both amounts SHALL use their returned currency codes

#### Scenario: Never-won row only has sold price

- **GIVEN** a never-won row has `currentPrice`
- **AND** no `maxBid`
- **WHEN** the row is displayed
- **THEN** the UI SHALL label the amount as sold/current price
- **AND** it SHALL NOT label the amount as the user's bid
