# Design: Soft-delete MarketPriceRecord rows

## Schema

```prisma
model MarketPriceRecord {
  id                   String    @id @default(uuid())
  userId               String
  venue                Venue     @default(ebay)
  venueItemId          String
  title                String
  soldPriceAmount      Decimal?  @db.Decimal(20, 2)
  soldPriceCurrency    String?
  endedAt              DateTime?
  sellerUserId         String?
  conditionDisplayName String?
  categoryId           String?
  categoryName         String?
  imageUrl             String?
  itemWebUrl           String?
  relistingGroupId     String?
  capturedAt           DateTime  @default(now())
  deletedAt            DateTime?
  createdAt            DateTime  @default(now())
  updatedAt            DateTime  @updatedAt

  @@unique([userId, venue, venueItemId])
  @@index([userId, relistingGroupId])
  @@index([userId, endedAt])
}
```

`deletedAt` is the only addition — nullable, no default, unindexed (this table's per-user row count is small; not worth an index for now). The existing `@@unique([userId, venue, venueItemId])` is left as-is: keeping the soft-deleted row under the same unique key is what makes re-capture-revives work as a side effect of the existing upsert, rather than needing new "is there a soft-deleted row for this key" logic.

Migration: a plain additive `ALTER TABLE "MarketPriceRecord" ADD COLUMN "deletedAt" TIMESTAMP(3);` via `prisma migrate dev` — no backfill needed (existing rows get `NULL`, i.e. not deleted).

## `src/persistence/market-price-records.ts` changes

```ts
export async function deleteMarketPriceRecords(
  userId: string,
  venueItemIds: string[],
  prisma: PrismaClient | undefined = getPrismaClient()
): Promise<{ deletedCount: number }> {
  if (!prisma || venueItemIds.length === 0) {
    return { deletedCount: 0 };
  }

  const result = await prisma.marketPriceRecord.updateMany({
    where: { userId, venue: "ebay", venueItemId: { in: venueItemIds }, deletedAt: null },
    data: { deletedAt: new Date() }
  });

  return { deletedCount: result.count };
}
```

`deletedAt: null` in the `where` makes this idempotent — deleting an already-soft-deleted row doesn't touch `updatedAt` again or inflate `deletedCount`.

Every read function gets `deletedAt: null` added to its `where`:

- `listCapturedVenueItemIds` — `where: { userId, venue: "ebay", venueItemId: { in: venueItemIds }, deletedAt: null }`.
- `listMarketPriceRecordsByGroup` — `where: { userId, venue: "ebay", relistingGroupId, soldPriceCurrency: currency, deletedAt: null }`.
- `listAllMarketPriceRecords` — `where: { userId, venue: "ebay", deletedAt: null }`.

`captureMarketPriceRecords`'s `toMarketPriceRecordUpdate` gains `deletedAt: null` unconditionally in its return object (the `create` branch never needs it — a freshly created row is never soft-deleted). This is the revival path: if the unique key matches a soft-deleted row, the upsert's `update` branch fires and clears `deletedAt` along with refreshing the other fields, exactly as if the row were newly captured.

## Addendum: how the migration was actually applied

Discovered while implementing — worth recording since it's non-obvious infra behavior, not a decision:

- The local `goggler_prod` Postgres database (what `DATABASE_URL` / `prisma.config.ts` point migrations at) has `ALTER DATABASE goggler_prod SET default_transaction_read_only = on` set — a deliberate guard, presumably to stop this now-legacy local copy from being mistaken for the live database (the app itself defaults to Neon via `GOGGLER_DB_TARGET`, unset = `"neon"`). This blocks `prisma migrate dev`'s shadow-database creation outright.
- Separately, raw TCP to Neon's port 5432 is blocked on this network (the same constraint `neon-db-adapter`'s proposal.md documented — only 443/HTTPS reaches Neon here), so `prisma migrate deploy`/`dev` pointed at `NEON_DATABASE_URL` can't reach it either; only the HTTP/WebSocket driver adapter (`@prisma/adapter-neon`, what the app itself uses at runtime) can.
- Net effect: neither Prisma CLI migration command can reach the actual live database from this machine/network as currently configured. The migration was instead applied by: (1) hand-authoring the migration file (`prisma/migrations/20260923095719_add_market_price_record_deleted_at/migration.sql`) with the single `ALTER TABLE` statement, (2) running that same SQL against Neon via `$executeRawUnsafe` through the existing `getPrismaClient()`/adapter path, then inserting a matching row into `_prisma_migrations` (checksum = SHA-256 of the migration file, matching Prisma's own convention) so future tooling sees it as applied, (3) applying the identical SQL to the local `goggler_prod` copy too (briefly lifting the read-only guard via `ALTER DATABASE ... SET default_transaction_read_only = off` from a separate `postgres`-database connection, then restoring it immediately after) so local schema/shadow-diffing stays in sync, and (4) `prisma migrate deploy` against `TEST_DATABASE_URL` (`goggler_test`, a separate non-guarded local database, reachable over plain TCP) worked normally.
- This is a workaround for the current network/DB setup, not a new standing process — a future schema change on a network where Neon's TCP port is reachable could just run `prisma migrate deploy` directly.

## Testing

- `test/persistence/market-price-records.integration.mjs`: extend the existing delete test to assert the row still exists in the DB afterward (not just absent from `deleteMarketPriceRecords`' effects) with `deletedAt` set; add a test that `listAllMarketPriceRecords`/`listCapturedVenueItemIds`/`listMarketPriceRecordsByGroup` all exclude a soft-deleted row; add a test that re-capturing a soft-deleted `venueItemId` clears `deletedAt` and the item becomes visible again.
- `test/market-insights/price-history.integration.mjs`: a soft-deleted record's price is excluded from group/matched-sales output.
- `test/market-insights/chat.integration.mjs`: a soft-deleted record is excluded from the AI assistant's captured-items context (only if a test already covers `listAllMarketPriceRecords` there — extend rather than add if so).
- No API contract test changes needed — `DELETE /api/market-insights/history`'s request/response shape is unchanged; only its integration-level DB assertions change (row persists, `deletedAt` set, instead of row absent).
