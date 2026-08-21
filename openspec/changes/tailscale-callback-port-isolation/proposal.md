# Proposal: Tailnet-only app UI with a narrowly-funneled eBay callback

## Why

[[tunnel-target-selection]] made Tailscale Funnel the default tunnel for manual eBay OAuth testing, but documented an accepted gap: Funnel exposes the *entire* app to the public internet with no auth gate, unlike ngrok's Google-OAuth-gated edge. We deliberately accepted that gap operationally (only run Funnel briefly, by hand) rather than building a real gate.

We've now confirmed, by testing live, that Tailscale actually supports closing this gap natively: `serve` and `funnel` state is tracked per `hostname:port`, not per path. Registering the app root only under `tailscale serve` on the primary port (tailnet-only, no funnel) and registering *only* `/api/auth/ebay/callback` under `tailscale funnel` on a separate port fully isolates them — confirmed live: the primary port serves the app to tailnet members, the funnel port serves only the callback path (`400` for a bare hit, as expected), and the funnel port's root is unreachable (`404`, no handler registered there at all).

This closes the exposure gap without inventing any new auth mechanism — the "gate" becomes tailnet membership itself, which is arguably stronger than ngrok's any-Google-account gate.

## What Changes

- **Operational (Tailscale config, not app code)**: run `tailscale serve` on the primary port (443) for the app root, and `tailscale funnel` on a separate port (8443) scoped to only `/api/auth/ebay/callback`. Both commands need the path repeated in the proxy target URL, not just `--set-path` — otherwise Tailscale strips the path and always forwards to the backend's root, which was confirmed live to break routing (a 404-shaped Next.js response, not the callback route's actual 400).
- **App code**: the eBay callback route currently builds its post-login browser redirect from whatever host the *inbound* request arrived on (`getPublicOrigin(request)`). With the port split, the callback route is now only ever reached via the funnel port (8443), so that redirect would incorrectly send the browser back to a `:8443` URL that has no root handler and 404s. `src/http/origin.ts` gains a `getPrimaryPublicOrigin(request)` export that always resolves to the primary tailnet-trusted origin (no port), independent of which host/port the current request arrived through; the callback route's `redirectToAccount` uses it instead of `getPublicOrigin`.
- **Docs**: AGENTS.md's "Manual Testing Against Production eBay" Tailscale section is rewritten to describe the two-port setup, replacing the single `tailscale funnel 3000` command and the "no edge gate" caveat from the prior change (which no longer applies).
- The eBay Developer Portal's registered accepted/declined URLs for the production RuName need to move from the single-port callback URL to the `:8443` one — a manual, external step, same as previous tunnel changes.

## Out of Scope

- Any change to the ngrok fallback path — it's unaffected, still a single URL gated by its own OAuth policy.
- Automating the Tailscale `serve`/`funnel` commands from app code or a startup script — still run manually per testing session, same as today.
- Broader deployment (Docker, hosting somewhere other than this Mac) — separate conversation.

## Success Criteria

- With both `tailscale serve` (port 443, app root) and `tailscale funnel` (port 8443, callback path only) configured, `tailscale funnel status --json`'s `AllowFunnel` map contains only the `:8443` entry — port 443 is never publicly funneled.
- A request to the callback path on the funnel port reaches the actual route handler (proven by application-level responses, e.g. `400 missing_authorization_code` for a bare hit — not a Next.js 404).
- A request to any other path on the funnel port returns `404` with no handler registered — the rest of the app is unreachable there.
- A full Production eBay OAuth login through this setup redirects the browser back to the primary (port 443) origin after completing, not the funnel port.
