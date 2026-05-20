## MODIFIED Requirements

### Requirement: Marketplace-style search
The UI SHALL provide a top-level search field for finding live eBay listings.

#### Scenario: Execute Home search
- **GIVEN** the user has connected eBay
- **WHEN** the user enters a search query and submits the top search field
- **THEN** the app SHALL switch to the Home tab
- **AND** the Home feed SHALL show live eBay Search results
- **AND** the Search filter tab SHALL be active

#### Scenario: Return from search to watchlist
- **GIVEN** the Home feed is showing Search results
- **WHEN** the user selects the On watchlist filter
- **THEN** the Home feed SHALL show current eBay watchlist rows

#### Scenario: Search result tags remain visible
- **GIVEN** a live eBay search result is on the watchlist, relisted, won, or never won according to loaded goggler state
- **WHEN** the row is displayed in Search results
- **THEN** its existing status tags SHALL remain visible on the card
