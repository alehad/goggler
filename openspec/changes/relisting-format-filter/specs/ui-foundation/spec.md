## MODIFIED Requirements

### Requirement: Marketplace-style search
The UI SHALL provide a top-level search field for finding live eBay listings.

#### Scenario: Relistings can be filtered by listing format
- **GIVEN** the Home feed is showing the `Relistings` filter
- **WHEN** the relisting format control is set to `Auction`
- **THEN** the listed relisting rows SHALL only include rows tagged `Auction`
- **AND** setting it to `Buy now` SHALL only include rows tagged `Buy now`
- **AND** setting it to `Both` SHALL include both auction and buy-now relisting rows

#### Scenario: Relisting format control is scoped to Relistings
- **GIVEN** the Home feed is showing Search, All, On watchlist, Won, or Never won
- **WHEN** the Home filters are rendered
- **THEN** the relisting format control SHALL be hidden
- **AND** the selected relisting format SHALL NOT filter those views
