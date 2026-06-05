# Tasks: Supplement purchases with GetOrders

- [x] Create OpenSpec change for `GetOrders` purchases supplement.
- [x] Add Trading API `GetOrders` request builder for buyer orders.
- [x] Add parser/normalizer for buyer order transactions into won-item rows.
- [x] Add date-window and pagination support within eBay limits.
- [x] Aim the `GetOrders` date window at the older gap before the recent `WonList` coverage.
- [x] Merge `WonList` and `GetOrders` purchases into a deduped superset.
- [x] Add optional diagnostics/warnings for source counts, overlap, truncation, and soft failures.
- [x] Update live history source to use the merged won-item set.
- [x] Add unit tests for request building, parsing, dedupe, and soft failure behavior.
- [x] Manually test against production eBay and compare missing purchases before the current cutoff.
- [x] Run OpenSpec validation, unit tests, build, and audit.
- [x] Run Copilot advisory security review.
