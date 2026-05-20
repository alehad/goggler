## ADDED Requirements

### Requirement: Selected-record sold-history lookup

The system SHALL provide a read-only way to request comparable eBay sold history for a selected purchased record when an approved data source is available.

#### Scenario: Approved sold-history source is available

- **GIVEN** the user has selected a purchased record
- **AND** an approved eBay sold-history API is configured
- **WHEN** the client requests selected-record history
- **THEN** the server SHALL query eBay using bounded, sanitized search criteria
- **AND** it SHALL return normalized sold-history rows without exposing OAuth tokens or secrets

#### Scenario: Source lookback is limited

- **GIVEN** the sold-history source only supports a lookback shorter than 12 months
- **WHEN** selected-record history is returned
- **THEN** the response SHALL include the available lookback period
- **AND** the UI SHALL NOT imply that 12 months of data is present

#### Scenario: Sold-history source is unavailable

- **GIVEN** the app lacks access to an approved sold-history API
- **WHEN** the client requests selected-record history
- **THEN** the server SHALL return a typed unavailable response
- **AND** it SHALL not fail the existing purchases history response
