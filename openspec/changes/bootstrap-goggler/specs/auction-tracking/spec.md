# Capability: Auction Tracking

## ADDED Requirements

### Requirement: Import not-won auction items

The system SHALL import not-won auction items from a connected user's buying history.

#### Scenario: Not-won item is available for tracking

- **GIVEN** a not-won item was imported for a user
- **WHEN** the user views imported not-won items
- **THEN** the item SHALL be available to track

### Requirement: Track lost auction items

The system SHALL allow a user to track imported not-won auction items.

#### Scenario: Track an imported item

- **GIVEN** a user is viewing imported not-won items
- **WHEN** the user chooses an item to track
- **THEN** the system SHALL include that item in future relisting searches

### Requirement: Candidate exact relistings

The system SHALL identify candidate active listings that may be exact relistings of tracked items.

#### Scenario: Candidate listing is suggested

- **GIVEN** a tracked item exists
- **WHEN** an active auction listing has enough matching signals
- **THEN** the system SHALL store the listing as a candidate for dashboard review

### Requirement: Match decisions

The system SHALL store user decisions about candidate relistings.

#### Scenario: User rejects a candidate

- **GIVEN** a candidate listing appears in the dashboard
- **WHEN** the user marks it as not the same item
- **THEN** the system SHALL store that decision and avoid presenting it as unresolved

