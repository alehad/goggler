# item-display Spec Delta

## ADDED Requirements

### Requirement: Seller names link to eBay seller pages

When an item row has a known seller user ID, the app SHALL render the seller name as a link to that seller's eBay page.

#### Scenario: Seller is known

- **GIVEN** an item row has a seller user ID
- **WHEN** the row metadata is displayed
- **THEN** the seller name SHALL link to a first-party eBay seller page for that seller

#### Scenario: Seller is unknown

- **GIVEN** an item row has no seller user ID
- **WHEN** the row metadata is displayed
- **THEN** the app SHALL display the existing unknown-seller fallback without a link
