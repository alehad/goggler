## ADDED Requirements

### Requirement: Purchases analytics summary

The Purchases tab SHALL summarize paid prices for won items.

#### Scenario: Won items have valid prices

- **GIVEN** buying history contains won items with valid paid prices
- **WHEN** the user opens Purchases
- **THEN** the view SHALL show average price paid
- **AND** the view SHALL show lowest price paid
- **AND** the view SHALL show highest price paid

#### Scenario: Won items have no valid prices

- **GIVEN** buying history contains no won items with valid paid prices
- **WHEN** the user opens Purchases
- **THEN** the analytics cards SHALL avoid displaying `£0.00` as if it were a real purchase price

### Requirement: Purchase price chart

The Purchases tab SHALL plot won items by purchase date and paid price.

#### Scenario: Won items have dates and prices

- **GIVEN** won items have valid paid prices and dates
- **WHEN** the user opens Purchases
- **THEN** each plottable won item SHALL appear as a dot on the chart
- **AND** the horizontal axis SHALL represent purchase dates
- **AND** the vertical axis SHALL represent paid prices

#### Scenario: User selects a chart point

- **GIVEN** a plotted purchase point is visible
- **WHEN** the user selects that point
- **THEN** the corresponding won item in the list SHALL be visually highlighted
- **AND** the selected chart point SHALL remain visually distinguishable

### Requirement: Purchase item cards

The Purchases tab SHALL render won items below the chart using the same compact listing-card language as Home.

#### Scenario: Won item list is displayed

- **GIVEN** buying history contains won items
- **WHEN** the user opens Purchases
- **THEN** each won item SHALL display title, thumbnail when available, paid price, seller/condition metadata when available, and purchase date when available
- **AND** items with trusted eBay URLs SHALL provide the existing external eBay item action
