# Tasks: Persist imported lost items

## Planning

- [x] Create OpenSpec proposal, design, tasks, and spec deltas.
- [x] Review and approve the lost-item persistence design before implementation.

## Persistence Model

- [x] Add `LostItem` and `LostItemImportRun` Prisma models.
- [x] Add and deploy the migration to `goggler_prod` and `goggler_test`.
- [x] Keep common field conventions aligned with `WonItem`.
- [x] Persist max-bid and sold-price amount/currency pairs separately.

## Lost Item Import

- [x] Add user-owned idempotent lost-item upserts.
- [x] Add sanitized lost-item import-run metadata.
- [x] Preserve stored non-empty fields when later eBay responses omit optional values.
- [x] Ensure absent live rows are never interpreted as deletions.

## Integration

- [x] Separate normalized live-list retrieval from relisting discovery and final response assembly.
- [x] Integrate lost-item persistence into successful live eBay history refreshes.
- [x] Return the persisted lost-item superset through the existing history response.
- [x] Recompute matching-derived fields and lost/won classifications from durable history.
- [x] Use the persisted lost-item superset for relisting discovery.
- [x] Keep watchlist rows and relisting candidates transient.

## Verification

- [x] Add persistence integration tests for insert, update, idempotency, retention, and user isolation.
- [x] Add tests for distinct max-bid and sold-price values/currencies.
- [x] Add tests proving watchlist rows and relisting candidates are not persisted.
- [x] Add tests proving token and raw upstream data are not persisted.
- [x] Run migrations, OpenSpec validation, unit tests, integration tests, build, audit, and advisory security review.
- [x] Manually verify against production eBay and inspect stored lost-item rows.
