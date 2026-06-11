# Design: Persist imported lost items

## Scope

This change extends the existing local PostgreSQL persistence layer to normalized lost/not-won eBay items. Won-item persistence remains unchanged. Watchlist items and live relisting candidates remain transient.

Persistence consumes the existing normalized `EbayBuyingHistoryItem` contract after the Trading API response has been parsed. It must never receive or store raw eBay XML, request headers, cookies, callback data, or OAuth credential material.

## Data Model Decision

Use a separate `LostItem` table rather than combining won and lost outcomes into one table.

Reasons:

- a lost eBay listing and a later won relisting are distinct venue items with distinct eBay item IDs
- lost items have loss-specific facts, especially the user's maximum bid and final/sold price
- won and lost histories have different retention and product uses
- separate tables keep outcome-specific constraints explicit and avoid nullable outcome-dependent columns on every row
- common field names can still be kept aligned between `WonItem` and `LostItem`

The first implementation should not introduce a shared inheritance-style database model or refactor `WonItem`. Duplication of the small set of common normalized fields is preferable to widening the change.

## `LostItem` Model

Common fields aligned with `WonItem`:

- `id`: app-owned stable primary key
- `userId`: owning goggler user ID
- `venue`: initially `ebay`
- `venueItemId`: eBay item ID
- `title`
- `sellerUserId`: optional eBay seller ID
- `conditionDisplayName`: optional condition text
- `categoryId`: optional eBay category ID
- `categoryName`: optional eBay category name
- `imageUrl`: optional trusted HTTPS image URL
- `itemWebUrl`: optional trusted eBay item URL
- `endedAt`: best available listing-end timestamp
- `firstImportedAt`
- `lastImportedAt`
- `createdAt`
- `updatedAt`

Lost-specific price fields:

- `maxBidAmount`: the user's maximum bid, when eBay returns it
- `maxBidCurrency`: currency associated with the user's maximum bid
- `soldPriceAmount`: final/current auction price returned for the lost listing
- `soldPriceCurrency`: currency associated with the final/current auction price

Uniqueness:

- unique composite key on `userId + venue + venueItemId`

The table must not persist `relistingGroupId`. That value is derived from user-editable matching preferences and should be recomputed when records are read.

The table must not persist a derived `eventuallyWon` or `neverWon` state. Whether a lost item was eventually won is determined by comparing its current derived matching group with the current persisted won-item set.

## Import-Run Metadata

Add a separate `LostItemImportRun` table following the existing won-item import-run pattern:

- `id`
- `userId`
- `venue`
- `startedAt`
- `completedAt`
- `status`
- `liveLostCount`
- `insertedCount`
- `updatedCount`
- `errorCode`: optional app-owned sanitized code
- timestamps

A separate table avoids renaming or broadening the already-deployed won-item import ledger. A future operational-metadata change may consolidate both ledgers after there is a concrete need.

## Import And Response Flow

For an authenticated live eBay history refresh:

1. Retrieve and normalize current live lost, won, and watchlist items using the active session-scoped OAuth token.
2. Persist and merge won items using the existing won-item persistence flow.
3. Start a lost-item import run.
4. Upsert each normalized live lost item using `userId + venue + venueItemId`.
5. Complete the lost-item import run with sanitized counts.
6. Read all persisted lost items for the current user.
7. Reapply current matching preferences to persisted lost and won items.
8. Discover relisting candidates using the persisted lost-item superset and persisted won-item superset.
9. Assemble the response classifications, counts, and Home feed from the durable supersets plus the transient live watchlist/candidates.
10. Return the persisted lost-item superset through `lostItems`.

An item absent from the latest eBay response must remain stored. Absence means only that it may have aged out of the rolling source window.

### Assembly Refactor

Today, `fetchLiveEbayHistoryResponse` retrieves live lists, discovers relistings, classifies items, and assembles the final response before the persistence layer sees it. That ordering is sufficient for won-item retention but would prevent older persisted lost items from participating in relisting discovery.

Implementation should separate these responsibilities:

- fetch and normalize a live source snapshot containing live lost, won, and watchlist rows plus diagnostics
- persist/merge won and lost rows into durable supersets
- discover relistings and assemble the final `EbayHistoryResponse` from those supersets

The active session-scoped OAuth token may continue to be passed to the live-search/discovery step in memory. It must never be passed into or stored by the persistence repository.

This refactor should preserve the current public route response contract and fixture behavior. It should remain narrowly scoped to making response assembly operate on the appropriate durable inputs.

## Relisting Discovery Behavior

Persisted lost items should become the durable source for future relisting discovery. This is the principal product benefit of the change.

The implementation must preserve the existing distinction between:

- eBay-sourced lost items: durable records of auctions the user actually bid on and did not win
- relisting candidates: transient live-search results that may correspond to a lost item

Relisting candidates must not be inserted into `LostItem`.

Because the persisted lost-item superset may grow, the existing bounded live-search behavior and deduplication rules must remain in place. Any broader batching, scheduling, or rate-limit redesign should be planned separately if production testing shows it is needed.

## Field Update Rules

On repeated imports:

- update title, price/currency pairs, seller, condition, category, trusted image URL, trusted item URL, and end timestamp when a newer non-empty value is available
- preserve an existing non-empty value when the latest response omits that field
- update each monetary amount together with its corresponding currency
- always update `lastImportedAt`
- preserve `firstImportedAt`

## Failure And Transaction Behavior

- If the live eBay fetch fails, do not start or mutate a lost-item import.
- If lost-item persistence fails, return a sanitized server error rather than returning a response that implies durable history was updated.
- Do not delete existing lost items during refresh.
- A failed lost-item import must not erase or corrupt already persisted won items.
- Import-run errors must use app-owned sanitized codes only.
- Never persist eBay OAuth tokens or raw upstream payloads.
- Require fresh eBay authentication when active-session credentials expire.

## API And UI Behavior

The existing `/api/ebay/buying-history` response remains compatible:

- `lostItems` becomes the persisted lost-item superset after a successful live refresh
- lost/never-won/eventually-won counts are recomputed from persisted lost and won items
- Home and Watching can continue using the current response contract
- relisting discovery uses the persisted lost-item superset

No new user-facing database controls are required in this change.

## Verification

Add PostgreSQL integration tests proving:

- first import inserts lost items
- repeated import is idempotent
- updated non-empty values refresh an existing row
- missing optional values do not erase stored values
- max-bid and sold-price values and currencies remain distinct
- items absent from later live responses remain stored
- records are isolated by user
- relisting candidates and watchlist items are never stored as lost items
- response classification and relisting input use the persisted lost-item superset
- persistent models contain no OAuth credential or raw upstream payload fields

Run Prisma migration deployment against `goggler_prod` and `goggler_test`, unit tests, persistence integration tests, OpenSpec validation, production build, audit, advisory security review, and a manual production eBay import inspection.

## Rollout

1. Add the OpenSpec plan and review it.
2. Add the `LostItem` and `LostItemImportRun` migration.
3. Add lost-item repository/import/merge behavior.
4. Split live source retrieval from final response assembly.
5. Integrate persistence after successful source retrieval and before response assembly.
6. Rebuild classifications and relisting discovery from the durable lost-item superset.
7. Add database-backed tests.
8. Apply migrations to both local databases.
9. Verify against production eBay and inspect stored rows.

## Open Questions

- Should a future user-facing history screen distinguish records currently returned by eBay from older persisted-only records?
- Should a future scheduled import capture lost items periodically before they age out of eBay's rolling window?
- If the durable lost-item set becomes large, should relisting discovery prioritize or batch records by recency?
