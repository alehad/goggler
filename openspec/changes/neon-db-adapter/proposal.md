# Change: Auto-select Postgres driver adapter by host (Neon vs local)

## Why

We're moving persistence to Neon (free-tier hosted Postgres) so the app's data survives independent of any one machine, ahead of building the macOS/iOS native frontends. Testing from this network directly exposed a real constraint: something on the current network path (likely a corp VPN/security tool — confirmed via a clean diagnostic showing port 443 reachable but port 5432 timing out on the identical Neon IP) blocks raw Postgres's TCP port 5432 outbound, while leaving 443 open. Neon's official Prisma driver adapter (`@prisma/adapter-neon`) tunnels the Postgres wire protocol over HTTPS/WebSocket instead of raw TCP, which we've already verified connects cleanly from this same blocked network.

The app currently always constructs a `PrismaPg` (raw TCP) adapter regardless of which database it's pointed at. Local Postgres needs to keep using `PrismaPg` (no reason to add HTTP/WebSocket overhead for a same-machine connection); Neon should use `PrismaNeon`. This needs to be decided automatically, not via a manual flag someone has to remember to flip.

## What Changes

- `src/persistence/prisma.ts` picks the driver adapter based on the connection string's hostname: any `*.neon.tech` host uses `PrismaNeon` (HTTP/WebSocket), everything else keeps using `PrismaPg` (raw TCP) as today.
- No manual environment flag, no network probing at startup — purely a deterministic function of which `DATABASE_URL` you're pointed at.

## Out Of Scope

- Actually switching the app's live `DATABASE_URL` over to Neon, running migrations against it, or migrating data — this change only makes the app *capable* of talking to either backend correctly. The cutover is a separate, later step once the schema and data are confirmed migrated.
- Any change to local Postgres behavior — `PrismaPg` usage for local/non-Neon hosts is unchanged.

## Success Criteria

- Pointing `DATABASE_URL` at the local Postgres instance behaves exactly as it does today (unaffected).
- Pointing `DATABASE_URL` (or a Neon-hosted connection string used ad hoc) at a `*.neon.tech` host automatically uses the HTTP/WebSocket adapter, with no other code or config changes required.
