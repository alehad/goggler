## MODIFIED Requirements

### Requirement: Won-item price statistics

The system SHALL NOT aggregate price statistics (average, lowest, or highest) across dissimilar won items. Each won item SHALL continue to display its own individual paid price in its own currency.

#### Scenario: Purchases view has no cross-item aggregate

- **GIVEN** the user has won items with valid purchase prices in one or more currencies
- **WHEN** the user opens Purchases
- **THEN** the view SHALL NOT display an average, lowest, or highest paid figure derived from unrelated items
- **AND** each won item SHALL continue to display its own paid price and currency on its own card and chart point
