# Design: Named, startup-selectable tunnel target (default Tailscale)

## Change

`src/http/origin.ts`:

```ts
const TUNNEL_TARGETS = ["tailscale", "ngrok"] as const;
type TunnelTarget = (typeof TUNNEL_TARGETS)[number];

const TUNNEL_TARGET_HOSTNAME_ENV_VARS: Record<TunnelTarget, string> = {
  tailscale: "GOGGLER_TAILSCALE_HOSTNAME",
  ngrok: "GOGGLER_NGROK_HOSTNAME"
};

function resolveTunnelTarget(): TunnelTarget {
  const raw = process.env.GOGGLER_TUNNEL_TARGET;
  if (raw === undefined) {
    return "tailscale";
  }
  if ((TUNNEL_TARGETS as readonly string[]).includes(raw)) {
    return raw as TunnelTarget;
  }
  throw new Error(
    `Invalid GOGGLER_TUNNEL_TARGET "${raw}" — expected one of: ${TUNNEL_TARGETS.join(", ")}`
  );
}

function trustedTunnelHost(): string | undefined {
  return process.env[TUNNEL_TARGET_HOSTNAME_ENV_VARS[resolveTunnelTarget()]];
}

function isAllowedForwardedOrigin(proto: string, host: string): boolean {
  const origin = `${proto}://${host}`;
  if (allowedConfiguredOrigins().has(origin)) {
    return true;
  }

  if (proto !== "https") {
    return false;
  }

  if (host === "localhost" || host.startsWith("localhost:")) {
    return true;
  }

  return host === trustedTunnelHost();
}
```

Everything else in the file (`getPublicOrigin`, `getAllowedRequestOrigins`, `isSecureRequest`, `allowedConfiguredOrigins`) is unchanged — `isAllowedForwardedOrigin` is the only function whose trust logic changes, and only in how it decides the tunnel-host branch.

Note the deliberate exact-match (`===`), not a suffix/`endsWith` check — see "Why this shape" below.

## Why this shape

- **Same pattern as [[db-target-selection]]**: named targets, explicit env var, default to the new preferred option, throw on garbage input. Reusing a pattern the user has already signed off on once keeps this predictable rather than inventing a new convention.
- **Exact hostname match, not suffix match — this is the important part.** `.ts.net` and `.ngrok-free.dev` are shared public suffixes operated by Tailscale and ngrok respectively; every customer's tunnel hostname lives under them, not just ours. A suffix check (`host.endsWith(".ts.net")`) would trust *any* Tailscale customer's Funnel hostname, not specifically ours — broader than intended. Since both our Tailscale Funnel hostname and our reserved ngrok hostname are fixed values (not randomly assigned per session), there is no need to match a suffix at all: matching the one exact expected hostname is both sufficient and correctly scoped. This also tightens the pre-existing (undocumented) ngrok trust, which was a suffix match before this change.
- **The hostname lives in an env var, not a code constant**: `GOGGLER_TAILSCALE_HOSTNAME`/`GOGGLER_NGROK_HOSTNAME` rather than hardcoding `goggler.tailde35d2.ts.net` in `src/http/origin.ts`. The tailnet name or reserved ngrok domain could change independently of a code deploy — keeping the actual value in config avoids a code change (and a new PR) if that ever happens, consistent with how other environment-specific values (`EBAY_PRODUCTION_REDIRECT_URI`, database URLs) are handled in this codebase.
- **`localhost` stays unconditional**: it was never gated behind the ngrok-specific branch before, and there's no reason to start gating it behind tunnel-target selection now — local-only requests aren't a tunnel concern.
- **Throwing on an invalid target**: this setting governs which host is trusted to receive the post-OAuth-login redirect. A silently-ignored typo could mean the redirect quietly falls back to `localhost` (as we saw happen when the trust check simply didn't match, before this change existed) — worth failing loudly instead, consistent with `GOGGLER_DB_TARGET`'s reasoning.
- **`GOGGLER_ALLOWED_PUBLIC_ORIGINS` untouched**: it's already a general-purpose exact-origin allowlist and doesn't need to know about targets — it stays the answer for any additional one-off origins beyond the single active target's hostname.
- **Two targets only, for now**: `tailscale` and `ngrok` cover the only two tunnel mechanisms actually in use for this project. Nothing about the shape prevents adding a third later.

## Testing

- Unit tests for the (now target-aware, exact-match) `isAllowedForwardedOrigin` behavior, exercised through `getPublicOrigin`/`getAllowedRequestOrigins` — the existing public surface of `src/http/origin.ts` — covering: unset target + `GOGGLER_TAILSCALE_HOSTNAME` set trusts exactly that host and rejects a different `*.ts.net` host; `GOGGLER_TUNNEL_TARGET=ngrok` + `GOGGLER_NGROK_HOSTNAME` set trusts exactly that host and rejects a different `*.ngrok-free.dev` host; an invalid target throws; `localhost` and `GOGGLER_ALLOWED_PUBLIC_ORIGINS` entries remain trusted under both targets; an unset target's hostname env var means nothing is trusted via that path (falls through to the existing untrusted-host behavior).
- Manual confirmation: re-run the Tailscale Funnel + Production eBay OAuth login end to end, this time with `GOGGLER_TUNNEL_TARGET` unset, `GOGGLER_TAILSCALE_HOSTNAME=goggler.tailde35d2.ts.net` set, and no `GOGGLER_ALLOWED_PUBLIC_ORIGINS` override in `.env.local` — confirms the default alone is sufficient.
