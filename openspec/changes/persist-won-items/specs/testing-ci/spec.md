# testing-ci Spec Delta

## ADDED Requirements

### Requirement: Won-item persistence integration tests

The system SHALL verify won-item persistence behavior against an isolated PostgreSQL test database.

#### Scenario: Persistence checks run

- **WHEN** persistence integration tests execute
- **THEN** they SHALL verify insert, update, idempotency, retention, and user isolation
- **AND** SHALL verify that persistent models contain no eBay token or raw upstream payload fields
