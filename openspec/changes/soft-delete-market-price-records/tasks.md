# Tasks: Soft-delete MarketPriceRecord rows

- [x] Create OpenSpec change documenting the design.
- [x] Wait for user sign-off on this design before implementing.
- [x] Add `deletedAt DateTime?` to `MarketPriceRecord` in `prisma/schema.prisma`; migration applied directly to Neon (live DB) and the local `goggler_test`/`goggler_prod` schema copies via a hand-authored migration file, since raw TCP `prisma migrate dev`/`deploy` can't reach Neon from this network (only the HTTP/WebSocket adapter can) — see design.md addendum below. Regenerated the Prisma client.
- [x] `deleteMarketPriceRecords`: switch from `deleteMany` to `updateMany` setting `deletedAt: new Date()`, with `deletedAt: null` in the `where` for idempotency.
- [x] Add `deletedAt: null` to the `where` clause of `listCapturedVenueItemIds`, `listMarketPriceRecordsByGroup`, and `listAllMarketPriceRecords`.
- [x] Add `deletedAt: null` to `toMarketPriceRecordUpdate`'s return object so re-capturing a soft-deleted item revives it.
- [x] Extend `test/persistence/market-price-records.integration.mjs`: row persists with `deletedAt` set after delete; idempotent re-delete; all three read functions exclude soft-deleted rows; re-capture clears `deletedAt`; the cross-user isolation test updated for soft-delete semantics.
- [x] `npm run build`, `npm run test:unit` (207/207), `npm run test:persistence` (56/56), `npm run openspec:validate` (63/63). `npm run lint` skipped — no ESLint config exists in this repo (pre-existing gap, unrelated to this change).
- [ ] Manual functional testing pause: user deletes an item on the web app, confirms it disappears from Analytics immediately (unchanged behavior), then a DB check confirms the row still exists with `deletedAt` set.
- [ ] Run dual security review (security-review skill + Copilot CLI), then ship via PR.
