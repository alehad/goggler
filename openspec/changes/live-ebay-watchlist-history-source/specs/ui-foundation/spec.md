# Capability: UI Foundation

## ADDED Requirements

### Requirement: Live-source compatible history UI

The existing Home, Watching, and Purchases views SHALL consume the same history route contract for both fixture and live eBay read sources.

#### Scenario: Live source returns watchlist rows

- **GIVEN** the buying-history source is configured as `live`
- **AND** eBay returns watchlist rows
- **WHEN** the user opens Home
- **THEN** the UI SHALL show watchlist rows first using the normalized watchlist order

#### Scenario: Live source returns empty lists

- **GIVEN** the buying-history source is configured as `live`
- **AND** eBay returns no watchlist, lost, or won items
- **WHEN** the user opens Home, Watching, or Purchases
- **THEN** the UI SHALL show an empty state rather than fixture records

#### Scenario: Live source error

- **GIVEN** the live source returns a recoverable error
- **WHEN** the user opens a history-backed view
- **THEN** the UI SHALL show a concise recoverable error message
- **AND** SHALL NOT show token or secret values
