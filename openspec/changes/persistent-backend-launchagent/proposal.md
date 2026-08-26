# Proposal: Persistent local backend via a launchd LaunchAgent

## Why

The native macOS app ([[macos-app-shell]], [[macos-watchlist-and-startup-check]]) is a client that expects a backend to just be reachable — manually restarting `npm run dev` and reconnecting Tailscale each session is exactly the friction that bit us this week. A Docker + Tailscale-sidecar approach was drafted and then deliberately rejected as overkill: it would have introduced a new stored secret (`TS_AUTHKEY`) and meaningfully more moving parts for a single-user personal app, for a problem that turns out not to need any of that.

Two things confirmed empirically rule out the bigger approach entirely:

- **Tailscale being connected never exposes Funnel.** `tailscale up` only makes tailnet-only `serve` mappings reachable to your own devices; the public-internet-facing Funnel port requires a separate, explicit `tailscale funnel` command every time and stays off otherwise. Making Tailscale persistently connected doesn't change the app's exposure at all.
- **The `tailscale serve` mapping (port 443, tailnet-only) already survives a reconnect** — confirmed by cycling `tailscale down`/`tailscale up` and checking `tailscale serve status` before and after: unchanged. It's stored as persistent per-node state, not something that has to be re-applied each session.

So the only two things that actually aren't persistent today are: Tailscale sometimes being fully quit, and the Next.js server needing to be started by hand. Both have small, local, no-new-secrets fixes.

## What Changes

- **The Next.js server runs via a `launchd` LaunchAgent** (`~/Library/LaunchAgents/com.goggler.server.plist`), started at login and restarted automatically if it exits, running `next start` against a production build (`next build`) rather than `next dev` — dev mode isn't meant to run unattended.
- **Tailscale's own "Open at Login" setting is enabled** (a one-time toggle in Tailscale.app's own preferences — not code, not something this change adds).
- **`AGENTS.md`** gains a short section describing this as the normal way to keep the backend up day-to-day, with `npm run dev` still documented as the interactive, hot-reload workflow for active development.
- **No change to the existing on-demand Docker packaging** ([[docker-tailnet-deployment]]) — it's untouched and still available if a portable/multi-machine story is wanted later; this is specifically the lightest fix for "this Mac, always reachable."

## Out of Scope

- The iMac — not needed for the immediate goal (the macOS app already points at this Mac's Tailscale hostname); revisit only if a second always-on machine is actually wanted.
- Docker, a Tailscale sidecar, or any new stored auth key — explicitly rejected as disproportionate for this app's actual needs.
- Automating the Funnel toggle for eBay OAuth testing — stays exactly as manual as it is today.
- Multi-architecture Docker builds — was only motivated by the sidecar/portability plan; not needed here.

## Success Criteria

- After logging out and back in (or rebooting), the goggler backend is reachable at the Tailscale hostname with zero manual commands — no `npm run dev`, no `tailscale serve`.
- The macOS app's startup gate passes straight through on a fresh launch after login, without needing Retry.
- If the Next.js process crashes or is killed, it comes back on its own within a few seconds.
- `next dev` remains available and unaffected for active development work.
