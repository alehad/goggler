# Tasks: Fix bulk price-history capture timing out on larger batches

- [x] Create OpenSpec change documenting the design (root cause confirmed live via temporary diagnostic logging, the fix, why `timeout` not `maxWait`).
- [x] Apply the fix. **Revised mid-flight per user direction**: instead of raising the transaction's timeout to a bigger fixed value, chunk the batch into groups of 10 (`CAPTURE_BATCH_SIZE`), one `$transaction` per chunk using Prisma's unmodified default 5000ms timeout — scales automatically if the route's batch-size cap ever changes, no timeout value to reconsider later.
- [x] Add an integration test capturing a larger batch (23 items, spanning 3 chunks) confirming every item across all chunks is persisted, not just the first — the local test DB's low latency can't reproduce the original 5s timeout directly, but this does catch a chunking-logic regression (e.g. only the first chunk persisting).
- [x] `npm run build`, `npm run test:unit` (207/207), `npm run test:persistence` (53/53, including the new test), `npm run openspec:validate` (62/62) clean.
- [x] Manual functional confirmation (user): retried the same 63-item "Capture all visible" batch that failed live — succeeded, confirmed via direct DB query: row count went from 215 → 278 (+63, exactly matching the capturable count from the logs), spot-checked several captured records for correct title/price/timestamp.
- [ ] Run dual security review (security-review skill + Copilot CLI) — small change, but touches a database transaction and logs an error's message/stack, worth the normal gate.
- [ ] Ship via PR.
