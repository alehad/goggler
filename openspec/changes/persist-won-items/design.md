# Design: Persist imported won items

## Scope

This change introduces the smallest useful durable-storage slice: won items and the metadata needed to understand imports. Live lost items, watchlist items, and relisting candidates remain transient.

The existing normalized `EbayBuyingHistoryItem` contract remains the adapter boundary. Persistence consumes normalized won items rather than raw eBay XML.

## Storage Technology

Use PostgreSQL with Prisma, matching the repository's existing architecture direction. The first implementation should run PostgreSQL locally on the Mac rather than connecting to a hosted provider.

Reasons:

- the persistence model and migrations can later move to hosted PostgreSQL without redesigning the application layer
- Prisma provides explicit schema migrations and typed access
- PostgreSQL supports future analytics and matching queries without replacing the first store
- isolated PostgreSQL databases can support deterministic persistence integration tests

The first local setup should use two separate databases:

- `goggler_prod`: real durable won-item history used by the locally running app
- `goggler_test`: isolated database used only by automated persistence tests

Each Mac has its own independent local databases and data. Moving the durable database to Neon or another hosted PostgreSQL provider is deferred until the local persistence behavior is proven.

Connection details should remain machine-local in `.env.local`:

```text
DATABASE_URL=postgresql://<local-role>@localhost:5432/goggler_prod
TEST_DATABASE_URL=postgresql://<local-role>@localhost:5432/goggler_test
```

## Data Model

### `WonItem`

Required persisted fields:

- `id`: app-owned stable primary key
- `userId`: owning goggler user ID
- `venue`: initially `ebay`
- `venueItemId`: eBay item ID
- `title`
- `itemPriceAmount`: decimal listing/won price when eBay returns it
- `currency`: ISO-style currency code when eBay returns it
- `purchasedAt`: best available won/purchase timestamp
- `sellerUserId`: optional eBay seller ID
- `conditionDisplayName`: optional condition text
- `categoryId`: optional eBay category ID
- `categoryName`: optional eBay category name
- `imageUrl`: optional trusted HTTPS image URL
- `itemWebUrl`: optional trusted eBay item URL
- `firstImportedAt`
- `lastImportedAt`
- `createdAt`
- `updatedAt`

Uniqueness:

- unique composite key on `userId + venue + venueItemId`

The first version should not persist `relistingGroupId`, because it is derived from user-editable matching preferences and can be recomputed when records are read.

The first version should not persist raw eBay XML or full raw API responses. This keeps the stored data minimal and avoids accidental storage of unrelated or sensitive fields.

### `WonItemImportRun`

Persist minimal operational metadata:

- `id`
- `userId`
- `venue`
- `startedAt`
- `completedAt`
- `status`: `running`, `succeeded`, or `failed`
- `liveWonCount`
- `insertedCount`
- `updatedCount`
- `errorCode`: optional app-owned sanitized code

Do not persist OAuth tokens, raw upstream errors, raw XML, callback query strings, request headers, or cookies.

This prohibition applies to every database and durable store in every environment. Encrypting, hashing, encoding, or otherwise transforming eBay OAuth credential material does not make it acceptable to persist.

## Import Flow

For an authenticated live eBay history refresh:

1. Retrieve the current live eBay lists using the session-scoped OAuth token.
2. Normalize the live won items using the existing adapter.
3. Start an import run.
4. Upsert each normalized won item using `userId + venue + venueItemId`.
5. Complete the import run with counts.
6. Read all persisted won items for the current user.
7. Reapply current matching preferences to the persisted records.
8. Return persisted won items as the response's `wonItems` set while keeping lost, watchlist, and relisting candidates live-only.

An item absent from the latest eBay response must remain stored. Absence means only that it may have aged out of the rolling source window.

## Field Update Rules

On repeated imports:

- update title, price/currency, seller, condition, category, trusted image URL, trusted item URL, and purchase timestamp when a newer non-empty value is available
- preserve an existing non-empty value when the latest response omits that field
- always update `lastImportedAt`
- preserve `firstImportedAt`

## Failure Behavior

- If the live eBay fetch fails, do not start or mutate a won-item import.
- If persistence is unavailable, return a sanitized server error in the first implementation rather than pretending the import succeeded.
- Use a transaction for the import run and won-item upserts where practical.
- Never delete historical won items as part of refresh.
- Never persist eBay OAuth tokens or raw upstream payloads.
- If a future import workflow needs credentials after the active session expires, require the user to authenticate with eBay again rather than storing refresh tokens.

## API And UI Behavior

The existing `/api/ebay/buying-history` response shape remains compatible. `wonItems` and won counts become database-backed after a successful live import.

The Purchases tab should therefore grow over time as new won items are imported, even after older items disappear from eBay's current response.

No new user-facing database controls are required in this change.

## Verification

Add database-backed integration tests that prove:

- a first import inserts won items
- repeating the same import is idempotent
- updated non-empty fields refresh the existing record
- missing newer optional fields do not erase stored values
- items absent from a later rolling-window response remain stored
- records are isolated by user
- tokens and raw OAuth/API data are not represented in persistent models
- the buying-history response returns the persisted superset

Run Prisma migration validation, persistence integration tests, unit tests, production build, audit, and advisory security review.

## Rollout

1. Install and start PostgreSQL locally.
2. Create `goggler_prod` and `goggler_test`.
3. Add Prisma/PostgreSQL tooling and schema.
4. Add the won-item repository/import service.
5. Integrate imports into the live buying-history route.
6. Add database-backed tests.
7. Manually verify with production eBay, then simulate a later rolling-window response that omits an already stored item.
8. Consider moving the durable database to Neon only after the local implementation is proven.

## Open Questions

- When should the proven local PostgreSQL database move to a shared hosted provider such as Neon?
- Should users later be able to correct or delete imported purchase records?
- Should a future scheduled import run periodically so purchases are captured before they age out of eBay's window?
