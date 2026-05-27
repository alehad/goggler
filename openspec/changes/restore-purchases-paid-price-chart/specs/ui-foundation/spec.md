## MODIFIED Requirements

### Requirement: Purchase price chart
The Purchases tab SHALL plot won items by purchase date and paid price.

#### Scenario: Won item chart remains primary
- **GIVEN** buying history contains won items with valid paid prices and dates
- **WHEN** the user opens Purchases
- **THEN** the Purchases tab SHALL show the paid-price chart for won items
- **AND** it SHALL NOT depend on marketplace sold-history access to render that chart

#### Scenario: Selecting a purchase highlights the local item
- **GIVEN** the paid-price chart is visible
- **WHEN** the user selects a chart point or purchase card
- **THEN** the corresponding won item SHALL be visually selected
- **AND** the chart SHALL remain the won-item paid-price chart
