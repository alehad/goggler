## ADDED Requirements

### Requirement: Analytics tab for price history capture

The app SHALL provide an Analytics bottom tab listing ended watchlist items with their capture status, supporting individual and bulk capture.

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
