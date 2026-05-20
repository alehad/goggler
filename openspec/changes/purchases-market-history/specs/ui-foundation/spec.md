## ADDED Requirements

### Requirement: Refined purchases chart

The Purchases tab SHALL render the all-purchases chart with legible grid lines and selected-item treatment.

#### Scenario: Purchases chart renders price grid

- **GIVEN** the user has purchases with valid prices
- **WHEN** the Purchases chart is rendered
- **THEN** it SHALL show faint horizontal price grid lines at readable price increments
- **AND** it SHALL preserve headroom above the highest paid price

#### Scenario: Selected purchase is below the fold

- **GIVEN** a purchase card is lower in the list
- **WHEN** the user selects its chart point
- **THEN** the highlighted card SHALL scroll into view without being hidden behind the bottom tab bar

#### Scenario: Purchase point has richer affordance

- **GIVEN** a purchase point is hovered, focused, or selected
- **WHEN** the chart renders the point
- **THEN** it SHALL show a clearer visual affordance than the default dot
- **AND** it MAY use the listing thumbnail when doing so does not clutter the chart

### Requirement: Purchases selected-record mode

The Purchases tab SHALL support switching between all-purchases overview and selected-record market history.

#### Scenario: User selects a purchased record

- **GIVEN** the user is viewing Purchases
- **WHEN** the user selects a purchase card or chart point
- **THEN** the tab SHALL offer a selected-record view for that purchase
- **AND** the user SHALL be able to return to the all-purchases overview

#### Scenario: Selected-record sales history is available

- **GIVEN** comparable sold-history data is available for the selected record
- **WHEN** the selected-record view is shown
- **THEN** the view SHALL show paid-by-me, highest sold, median sold, and lowest sold values
- **AND** it SHALL chart comparable sold prices over the available lookback window

#### Scenario: Selected-record sales history is unavailable

- **GIVEN** comparable sold-history data is unavailable or API access is not enabled
- **WHEN** the selected-record view is shown
- **THEN** the view SHALL keep the selected purchase visible
- **AND** it SHALL explain that sold-history data is unavailable without breaking the all-purchases view
