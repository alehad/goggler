## MODIFIED Requirements

### Requirement: Home feed filtering
The Home feed SHALL support live eBay search results tagged by loaded buying-history and watchlist rows.

#### Scenario: Search live eBay rows
- **GIVEN** loaded Home feed rows include a watchlist item titled `BNJ71001`
- **AND** a lost bid row tagged `Never won`
- **WHEN** the user searches for matching terms
- **THEN** the results SHALL be fetched from live eBay Browse search
- **AND** matching live results SHALL be tagged using loaded Home feed state
