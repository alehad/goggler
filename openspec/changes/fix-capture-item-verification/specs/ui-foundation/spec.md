## ADDED Requirements

### Requirement: Analytics tab surfaces skipped captures

When a capture request (single item or "Capture all visible") results in one or more requested items being skipped by the server, the Analytics tab SHALL show the user which items were skipped rather than appearing to silently succeed.

#### Scenario: A requested item's price could not be independently verified

- **GIVEN** the user requests capture of one or more ended-watchlist items
- **WHEN** the server cannot independently resolve the current price for one or more of those items
- **THEN** the response's `skipped` ids SHALL be shown to the user, identified by title where available
- **AND** the message SHALL indicate how many of the requested items were actually captured

#### Scenario: Nothing is skipped

- **GIVEN** every requested item is captured successfully
- **WHEN** the capture completes
- **THEN** no skipped-items message SHALL be shown
