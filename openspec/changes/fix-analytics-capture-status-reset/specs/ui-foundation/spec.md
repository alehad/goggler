## MODIFIED Requirements

### Requirement: Analytics tab for price history capture

The app SHALL provide an Analytics bottom tab listing ended watchlist items with their capture status, supporting individual and bulk capture. A captured status SHALL remain accurate across navigation away from and back to the Analytics tab within the same session.

#### Scenario: Analytics tab lists ended items with capture status

- **GIVEN** the user has ended watchlist items
- **WHEN** the user opens the Analytics tab
- **THEN** each item SHALL show its title, final price, seller, condition, ended date, and a Captured/Not-captured status

#### Scenario: User captures a single item

- **GIVEN** an ended item is shown as Not captured
- **WHEN** the user selects the capture action for that item
- **THEN** the item SHALL be persisted to price history
- **AND** its status SHALL update to Captured

#### Scenario: User captures all visible not-captured items

- **GIVEN** the Analytics tab is showing a mix of captured and not-captured items
- **WHEN** the user selects the bulk capture action
- **THEN** every currently-filtered not-captured item SHALL be captured in one action

#### Scenario: User filters by capture status

- **GIVEN** the Analytics tab has both captured and not-captured items
- **WHEN** the user selects the Captured or Not-captured filter
- **THEN** the list SHALL show only items matching that status

#### Scenario: Captured status survives switching tabs and back

- **GIVEN** the user just captured an item (individually or via bulk capture) on the Analytics tab
- **WHEN** the user switches to a different tab and then returns to Analytics
- **THEN** that item SHALL still show as Captured, without requiring a full history refresh
