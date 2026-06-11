# Proposal: Persist imported lost items

## Why

eBay exposes the authenticated user's lost/not-won buying history through a rolling recent window. Once a lost item ages out of that window, goggler can no longer use it to identify future relistings or show a complete record of auctions the user participated in.

goggler should retain normalized lost items that it has previously imported, just as it now retains won items.

## What Changes

- Add durable PostgreSQL persistence for normalized lost/not-won items.
- Keep lost items in a separate table from won items while using the same common listing-field conventions.
- Persist both the user's maximum bid and the final/sold price when eBay returns them.
- Upsert lost items after each successful live eBay history refresh.
- Return the persisted lost-item superset through the existing buying-history response.
- Use the persisted lost-item superset as the source for unresolved/history classification and live relisting discovery.
- Never delete a persisted lost item merely because it is absent from a later rolling-window eBay response.
- Record minimal sanitized lost-item import-run metadata.
- Continue prohibiting persistence of eBay OAuth credential material and raw upstream payloads.

## Out Of Scope

- Persisting watchlist items or relisting candidates.
- Persisting eBay OAuth tokens, authorization codes, credentials, or raw API payloads.
- Automatically deleting a lost item after a later win.
- Treating a later win as proof that the original lost eBay listing itself changed outcome.
- Background or scheduled imports.
- User-facing editing, deletion, or archival controls.
- Moving PostgreSQL to a hosted provider.

## Success Criteria

- A lost item imported today remains available after it ages out of eBay's live rolling window.
- Re-importing the same lost eBay item updates it without creating a duplicate.
- Maximum-bid and final/sold-price amounts retain their independent currencies.
- Persisted lost items continue to participate in never-won/eventually-won classification and relisting discovery.
- Database-backed tests prove that eBay credential material and raw upstream payloads are not persisted.
