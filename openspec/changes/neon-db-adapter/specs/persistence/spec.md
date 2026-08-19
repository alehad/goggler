## ADDED Requirements

### Requirement: Postgres driver adapter is selected automatically by connection host

The system SHALL select its Prisma driver adapter automatically based on the hostname in the resolved `DATABASE_URL`, without requiring a separate manual configuration flag.

#### Scenario: Connection string points at a Neon-hosted database

- **GIVEN** a connection string whose host ends in `.neon.tech`
- **WHEN** the Prisma client is constructed
- **THEN** it SHALL use the HTTP/WebSocket-based Neon driver adapter

#### Scenario: Connection string points at a non-Neon database

- **GIVEN** a connection string whose host does not end in `.neon.tech` (e.g. local Postgres)
- **WHEN** the Prisma client is constructed
- **THEN** it SHALL use the raw TCP `pg` driver adapter, unchanged from today's behavior
