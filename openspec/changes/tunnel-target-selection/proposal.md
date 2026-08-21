# Proposal: Named, startup-selectable tunnel target (default Tailscale)

## Why

Manual testing against Production eBay requires a public HTTPS URL for the OAuth callback, and the app validates the `x-forwarded-host`/`x-forwarded-proto` pair it's given against a trusted-origin allowlist (`src/http/origin.ts`) before using it to build the post-login redirect. Today that allowlist hardcodes the `*.ngrok-free.dev` *suffix* as trusted and has no knowledge of Tailscale Funnel's `*.ts.net` hostnames.

We proved yesterday that Tailscale Funnel is a viable, free replacement for ngrok's role in this flow — it produces a real public HTTPS hostname (`https://goggler.tailde35d2.ts.net`), and the eBay OAuth round-trip (login, callback, `?account=ebay_connected`) worked end-to-end once the app was told to trust that host. The only way we got it working was a manual, uncommitted `GOGGLER_ALLOWED_PUBLIC_ORIGINS` entry in `.env.local` — a real workaround, but not a documented or durable one, and it doesn't express the actual intent: **Tailscale is now the default way we expose the app publicly; ngrok is a fallback we still want available on request.**

This mirrors the shape of [[db-target-selection]]: instead of one hardcoded trusted suffix, the app should support named tunnel targets, default to the new preferred one, and let a startup parameter pick the other explicitly.

**Suffix trust is broader than intended, and this change tightens it.** `.ts.net` and `.ngrok-free.dev` are shared public suffixes — every Tailscale/ngrok customer's tunnel hostname lives under them, not just ours. Trusting the whole suffix means trusting "any hostname Tailscale/ngrok happens to operate," not "our specific tunnel." Both our Tailscale Funnel hostname and our ngrok hostname are fixed, reserved values (not randomly assigned), so there's no need for suffix matching at all — an exact hostname match is both sufficient and meaningfully tighter, closing a pre-existing gap in the ngrok trust logic as a side effect.

## What Changes

- `src/http/origin.ts` gains a `GOGGLER_TUNNEL_TARGET` env var with two named targets: `tailscale` and `ngrok`, defaulting to `tailscale` when unset.
- Each target names an env var holding its **one exact expected hostname** — `GOGGLER_TAILSCALE_HOSTNAME` for `tailscale`, `GOGGLER_NGROK_HOSTNAME` for `ngrok` — and a forwarded host is trusted only on an exact match against that value, not a suffix match.
- An unrecognized `GOGGLER_TUNNEL_TARGET` value fails loudly (same reasoning as `GOGGLER_DB_TARGET`: this setting decides which host is trusted to receive the post-OAuth redirect, so a typo silently trusting nothing — or the wrong thing — is worse than a startup error).
- `localhost` stays trusted unconditionally, as it is today, regardless of target.
- The exact-match `GOGGLER_ALLOWED_PUBLIC_ORIGINS` override is unchanged — it remains available for any additional one-off origins.
- This formalizes and replaces yesterday's manual `.env.local` workaround, and tightens the existing (undocumented) ngrok trust from a suffix match to an exact hostname match.
- `.env.example` and `AGENTS.md`'s "Manual Testing Against Production eBay" section are updated to describe Tailscale Funnel as the default path, with ngrok as the explicit `GOGGLER_TUNNEL_TARGET=ngrok` fallback.

## Out of Scope

- Actually starting/stopping the Tailscale or ngrok processes from app code — both remain external tools the developer runs manually (or via a future startup script), same as today.
- Any change to the `dev-tunnel-security` capability's existing ngrok OAuth-gate requirement (Google auth at the ngrok edge) — that mechanism stays ngrok-specific. **Note this is a real, accepted gap, not a non-issue**: unlike ngrok's Google-OAuth-gated edge, Tailscale Funnel exposes the whole app to the public internet with no gate in front of it (Funnel is the public-facing counterpart to tailnet-only Serve). The accepted mitigation is operational, not technical — Funnel is only run briefly, by hand, during active manual testing, and the app itself exposes nothing sensitive to an unauthenticated visitor. This is documented plainly in AGENTS.md rather than silently assumed equivalent to ngrok's protection. Revisit if this tunnel is ever left running unattended or the app starts exposing more before login.
- Deploying the app anywhere off this Mac, Docker packaging, or broader access-control design — this change only fixes which tunnel hostnames the app trusts for the OAuth redirect. Broader deployment is a follow-up conversation.

## Success Criteria

- With `GOGGLER_TUNNEL_TARGET` unset, a request forwarded through a `*.ts.net` host (Tailscale Funnel) is trusted and used for the post-OAuth redirect; a request forwarded through a `*.ngrok-free.dev` host is not.
- With `GOGGLER_TUNNEL_TARGET=ngrok`, the reverse is true.
- An invalid `GOGGLER_TUNNEL_TARGET` value throws a clear error at resolution time.
- `localhost` and any origin listed in `GOGGLER_ALLOWED_PUBLIC_ORIGINS` remain trusted regardless of target.
- With `GOGGLER_TUNNEL_TARGET` unset and `GOGGLER_TAILSCALE_HOSTNAME=goggler.tailde35d2.ts.net`, only that exact host is trusted — a different `*.ts.net` host is not.
- Manually verified against Production eBay via Tailscale Funnel with `GOGGLER_TUNNEL_TARGET` unset (no `.env.local` origin-allowlist override needed).
