## ADDED Requirements

### Requirement: Trusted eBay item links

The system SHALL expose a trusted public eBay item URL for active listing rows when the upstream eBay response provides one.

#### Scenario: Live item URL is available

- **GIVEN** a live eBay buying-history item contains an HTTPS eBay item URL
- **WHEN** the system normalizes the item into the Home feed contract
- **THEN** the corresponding row SHALL include the item URL
- **AND** the URL SHALL NOT contain OAuth access tokens, session identifiers, or application secrets

#### Scenario: Unsafe item URL is rejected

- **GIVEN** a live eBay buying-history item contains a non-eBay, non-HTTPS, local, private, or malformed item URL
- **WHEN** the system normalizes the item
- **THEN** the corresponding row SHALL omit the item URL
- **AND** the system SHALL continue processing the remaining history response

### Requirement: Read-only watchlist assist

The system SHALL support adding relisted items to the user's eBay watchlist through an eBay-hosted user action rather than mutating the eBay watchlist directly.

#### Scenario: User chooses to review a relisted item on eBay

- **GIVEN** a relisted active item is not already on the user's eBay watchlist
- **AND** the item has a trusted eBay item URL
- **WHEN** the user selects the eBay action from goggler
- **THEN** goggler SHALL navigate the user to the eBay item page
- **AND** goggler SHALL NOT call a write-capable eBay watchlist API
