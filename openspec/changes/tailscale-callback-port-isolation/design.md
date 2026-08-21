# Design: Tailnet-only app UI with a narrowly-funneled eBay callback

## Tailscale configuration (operational, not app code)

```bash
# Primary app UI: tailnet-only, no funnel
tailscale serve --bg --set-path=/ http://127.0.0.1:3000

# eBay callback only: publicly funneled, on a separate port
tailscale funnel --https=8443 --bg --set-path=/api/auth/ebay/callback http://127.0.0.1:3000/api/auth/ebay/callback
```

The path must be repeated in both `--set-path` and the backend target URL. Confirmed live: with a bare-origin target (`http://127.0.0.1:3000`, no path), Tailscale strips the path when proxying and always forwards to the backend's root — the callback route never saw the request, and the app returned a Next.js 404-shaped page instead of the route handler's actual response. Repeating the path in the target fixes this.

Resulting `tailscale funnel status --json` shape (confirmed live):

```json
{
  "Web": {
    "goggler.tailde35d2.ts.net:443": { "Handlers": { "/": { "Proxy": "http://127.0.0.1:3000" } } },
    "goggler.tailde35d2.ts.net:8443": { "Handlers": { "/api/auth/ebay/callback": { "Proxy": "http://127.0.0.1:3000/api/auth/ebay/callback" } } }
  },
  "AllowFunnel": { "goggler.tailde35d2.ts.net:8443": true }
}
```

`AllowFunnel` is keyed by `hostname:port` only — this is the mechanism that makes the isolation real. Port 443 has no entry there at all, so it's never reachable from outside the tailnet, regardless of what's registered under `serve` for it.

## App code change

`src/http/origin.ts`:

```ts
export function getPrimaryPublicOrigin(request: NextRequest): string {
  const host = trustedTunnelHost();
  if (host) {
    return `https://${host}`;
  }
  return request.nextUrl.origin;
}
```

`app/api/auth/ebay/callback/route.ts`'s `redirectToAccount`:

```ts
function redirectToAccount(request: NextRequest, status: string): NextResponse {
  return NextResponse.redirect(new URL(`/?account=${encodeURIComponent(status)}`, getPrimaryPublicOrigin(request)));
}
```

That's the only code change. Everything else in the callback route is unaffected:

- Session lookup relies on the `goggler_session` cookie, which is not port-scoped by browsers (RFC 6265 cookies don't distinguish by port) — a cookie set while browsing the primary origin (port 443) is sent by the browser when it's redirected to the callback on port 8443.
- OAuth state validation, replay protection, and the token exchange itself don't touch `getPublicOrigin`/host trust at all.
- `isSecureRequest`/`getAllowedRequestOrigins` (used by session creation, sign-out, CSRF) are never invoked on a request that arrived via the funnel port, since no other route is ever exposed there — no change needed to their behavior.

## Why this shape

- **`getPrimaryPublicOrigin` reuses `trustedTunnelHost()`, not a new env var.** The primary origin is, by definition, the same hostname already configured as trusted (`GOGGLER_TAILSCALE_HOSTNAME`/`GOGGLER_NGROK_HOSTNAME` depending on `GOGGLER_TUNNEL_TARGET`) — just without a request-specific host/port to mirror. No new configuration surface.
- **Doesn't touch `isAllowedForwardedOrigin`/`getPublicOrigin` at all.** Those remain scoped to recognizing the primary origin for cookie-security-flag and CSRF purposes on routes that are only ever reached via the primary port. The funnel port never needs to be "trusted" by that mechanism, since nothing security-sensitive is decided from the callback request's own host — only from the signed OAuth state and session cookie.
- **ngrok is unaffected.** `getPrimaryPublicOrigin` falls through to the same `trustedTunnelHost()` value ngrok already uses, so when `GOGGLER_TUNNEL_TARGET=ngrok`, `getPrimaryPublicOrigin` and `getPublicOrigin` resolve identically — there's no port split for ngrok, since its single reserved URL is already gated by the Google OAuth edge policy.
- **The path-in-target quirk is Tailscale's behavior, not ours** — documenting it in AGENTS.md (not just here) matters so a future session doesn't rediscover it the hard way.

## Testing

- Unit test for `getPrimaryPublicOrigin`: with `GOGGLER_TAILSCALE_HOSTNAME` set, returns `https://<that host>` regardless of the request's own forwarded host/port; with no tunnel hostname configured, falls back to `request.nextUrl.origin`.
- Manual confirmation (already partially done live during design): `tailscale funnel status --json` shows `AllowFunnel` scoped to only the funnel port; a bare hit on the funnel port's callback path reaches the route handler; the funnel port's root 404s. Remaining: full Production eBay OAuth login through this setup, confirming the browser lands back on the port-443 origin after completing.
