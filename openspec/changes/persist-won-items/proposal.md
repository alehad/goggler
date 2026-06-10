# Proposal: Persist imported won items

## Why

eBay's live buying-history APIs expose only a rolling recent window. Production testing currently returns 13 won items, but purchases that age out of the eBay window disappear from goggler and therefore from Purchases analytics.

goggler should retain won items that it has previously imported so the Purchases experience becomes more useful over time.

## What Changes

- Add locally hosted PostgreSQL and Prisma as the first durable application persistence layer.
- Persist normalized won items only.
- Upsert won items after each successful live eBay history refresh.
- Merge persisted won items with the latest live won items before returning the buying-history response.
- Never delete a persisted won item merely because it is absent from a later rolling-window eBay response.
- Record minimal import-run metadata for diagnostics and safe retry behavior.
- Keep eBay OAuth access tokens, refresh tokens, authorization codes, and raw OAuth callback data out of persistent storage.

## Out Of Scope

- Hosted PostgreSQL or Neon integration.
- Persisting lost/not-won items.
- Persisting watchlist items.
- Persisting relisting candidates.
- Persisting eBay OAuth token values.
- Background or scheduled imports.
- User-facing editing or deletion of purchase history.
- Migrating browser-local matching preferences.

## Success Criteria

- A won item imported today remains visible after it ages out of eBay's live rolling window.
- Re-importing the same eBay won item updates it without creating a duplicate.
- A temporary database failure does not expose secrets or partially delete existing won history.
- Database-backed tests prove that eBay token values are not persisted.
