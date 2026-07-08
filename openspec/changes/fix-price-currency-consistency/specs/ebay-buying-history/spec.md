## MODIFIED Requirements

### Requirement: Item price currency reflects the true native listing currency

Prices for active listings (Search results, relisting candidates, and watchlist rows) SHALL reflect the currency the item is natively listed in on eBay, not a currency eBay converted the price into for the requested marketplace. The system SHALL NOT substitute a fabricated price or currency when no price is available from any source.

#### Scenario: eBay discloses a native currency different from the marketplace default

- **GIVEN** eBay returns a price with `convertedFromValue`/`convertedFromCurrency` (Browse API) or a `ConvertedCurrentPrice` sibling next to `CurrentPrice` (Trading API)
- **WHEN** goggler builds the row for that item
- **THEN** the row SHALL show the native value and currency, not the converted one

#### Scenario: Trading API cannot disclose the native currency for a watchlist item

- **GIVEN** a watchlist item has real bid activity and `GetMyeBayBuying` returns only a marketplace-currency `CurrentPrice` with no `ConvertedCurrentPrice` sibling
- **WHEN** goggler builds the watchlist row
- **THEN** the system SHALL look up the item's native price via the Browse API and use that value when available

#### Scenario: No price is available from any source

- **GIVEN** neither the Trading API nor a Browse API lookup returns a parseable price for a watchlist item
- **WHEN** goggler builds the watchlist row
- **THEN** the row SHALL have no `currentPrice`
- **AND** it SHALL NOT default to a fabricated `{ value: 0, currency: "GBP" }`
