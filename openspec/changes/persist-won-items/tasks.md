# Tasks: Persist imported won items

## Planning

- [x] Create OpenSpec proposal, design, tasks, and spec deltas.
- [x] Review and approve the persistence design before implementation.

## Persistence Foundation

- [x] Install and start PostgreSQL locally.
- [x] Create local `goggler_prod` and `goggler_test` databases.
- [x] Add Prisma and local PostgreSQL configuration.
- [x] Add initial migration for won items and import-run metadata.
- [x] Add an isolated persistence test database setup.

## Won Item Import

- [x] Add a won-item repository with user-owned idempotent upserts.
- [x] Add an import service that records sanitized import-run metadata.
- [x] Preserve stored non-empty fields when later eBay responses omit optional values.
- [x] Ensure absent live rows are never interpreted as deletions.

## Integration

- [x] Integrate won-item import into successful live eBay history refreshes.
- [x] Return the persisted won-item superset through the existing history response.
- [x] Recompute matching-derived fields from current matching preferences.
- [x] Keep lost, watchlist, and relisting candidate rows transient.

## Verification

- [x] Add persistence integration tests for insert, update, idempotency, retention, and user isolation.
- [x] Add tests proving token and raw upstream data are not persisted.
- [x] Document how CI PostgreSQL integration checks will be added later.
- [x] Run OpenSpec validation, unit tests, integration tests, build, audit, and advisory security review.
- [x] Manually verify against production eBay.
