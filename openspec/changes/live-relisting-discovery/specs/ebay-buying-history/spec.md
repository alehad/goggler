## MODIFIED Requirements

### Requirement: Selected purchase market-history query
The selected purchase market-history flow SHALL prefer a catalogue or record identifier query when one can be extracted from the selected title.

#### Scenario: Hyphenated generic record identifier drives market-history search
- **GIVEN** a selected purchase title includes `BNJ-71001`
- **WHEN** market history is requested
- **THEN** the eBay market-history search query SHALL be `BNJ71001`
- **AND** the query source SHALL be catalogue or record identifier matching

### Requirement: Live eBay watchlist and history source
The eBay adapter SHALL support a live read source that retrieves the connected user's eBay watchlist, lost buying history, and won buying history using the current session-scoped OAuth token.

#### Scenario: Discover live relisting candidates from lost bids
- **GIVEN** the buying-history source is configured as `live`
- **AND** the connected user's lost history includes an unresolved lost bid titled `Blue Note BNJ-71001 promo pressing`
- **AND** the lost bid has an eBay category
- **WHEN** goggler imports buying history
- **THEN** it SHALL search live eBay listings for `BNJ71001`
- **AND** matching live listings from the same category SHALL be returned as relisting candidates
- **AND** matching live listings from a different category SHALL be excluded
- **AND** matching candidates not already on the watchlist SHALL appear as needs-action Home rows

#### Scenario: Tag live relisting listing format
- **GIVEN** a discovered live relisting candidate has Browse buying option `AUCTION`
- **WHEN** the Home feed is displayed
- **THEN** the candidate SHALL be tagged as an auction
- **AND** a candidate with Browse buying option `FIXED_PRICE` SHALL be tagged as buy now
