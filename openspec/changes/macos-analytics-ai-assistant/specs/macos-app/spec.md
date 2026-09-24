## ADDED Requirements

### Requirement: Analytics tab AI assistant answers questions about price history

The macOS app's Analytics tab SHALL let the user ask a natural-language question about their price history, calling the existing `POST /api/market-insights/chat` endpoint, and SHALL display the returned answer.

#### Scenario: Asking a question returns an answer

- **GIVEN** the user has typed a question into the assistant field
- **WHEN** they submit it
- **THEN** the app SHALL call `POST /api/market-insights/chat` with that question
- **AND** SHALL display the returned answer once it arrives

#### Scenario: The request fails

- **GIVEN** the assistant request fails or the backend returns a non-success status
- **WHEN** the failure occurs
- **THEN** the app SHALL show a generic "could not answer" message rather than leaving the user with no feedback

### Requirement: AI assistant answers filter the Analytics list to referenced items

When the assistant's answer references specific items, the Analytics list SHALL show exactly those items, in the order the assistant returned them, overriding the capture-status, win-status, and search filters until cleared.

#### Scenario: Answer references specific items

- **GIVEN** an assistant answer includes one or more referenced item IDs
- **WHEN** the answer is displayed
- **THEN** the Analytics list SHALL show exactly those items, in that order
- **AND** the existing capture-status, win-status, and search filters SHALL have no effect while this AI filter is active

#### Scenario: Clearing the AI filter restores normal filtering

- **GIVEN** an AI filter is currently active
- **WHEN** the user clears it
- **THEN** the Analytics list SHALL return to reflecting the capture-status, win-status, and search filters as normal
