## ADDED Requirements

### Requirement: The Purchases tab shows won items from the real backend

The macOS app's Purchases tab SHALL render `wonItems` from the same `POST /api/ebay/buying-history` response Home and Watchlist already fetch via the shared store, searchable by title or seller, alongside a count and a control to re-fetch the data.

#### Scenario: Searching narrows the list by title or seller

- **GIVEN** the Purchases tab has loaded won items from the backend
- **WHEN** the user types a search term
- **THEN** only items whose title or seller matches (case-insensitively) SHALL be shown
- **AND** clearing the search SHALL restore the full list

#### Scenario: Purchases shares the backend call with Home and Watchlist, not a fourth

- **GIVEN** the shared store has already loaded buying history
- **WHEN** the user switches to the Purchases tab
- **THEN** the app SHALL NOT make an additional `POST /api/ebay/buying-history` call
- **AND** SHALL render the already-loaded data
