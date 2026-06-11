# testing-ci Spec Delta

## ADDED Requirements

### Requirement: Lost-item persistence integration tests

The system SHALL verify lost-item persistence behavior against an isolated PostgreSQL test database.

#### Scenario: Lost-item persistence checks run

- **WHEN** lost-item persistence integration tests execute
- **THEN** they SHALL verify insert, update, idempotency, retention, user isolation, and distinct maximum-bid/final-price handling
- **AND** SHALL verify that watchlist items and relisting candidates are not persisted as lost items
- **AND** SHALL verify that persistent models contain no eBay token or raw upstream payload fields
