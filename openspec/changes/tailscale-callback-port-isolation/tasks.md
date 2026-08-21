# Tasks: Tailnet-only app UI with a narrowly-funneled eBay callback

- [x] Create OpenSpec change documenting the design (includes live-tested Tailscale config findings).
- [x] Wait for user sign-off on this design before implementing.
- [x] Implement `getPrimaryPublicOrigin` in `src/http/origin.ts`; use it in `app/api/auth/ebay/callback/route.ts`'s `redirectToAccount`.
- [x] Add a unit test for `getPrimaryPublicOrigin`: trusted-hostname case ignores the request's own forwarded host/port; unset-hostname case falls back to `request.nextUrl.origin`.
- [x] Update AGENTS.md's "Manual Testing Against Production eBay" Tailscale section: two-port setup (serve on primary port, funnel scoped to the callback path on a separate port), including the path-must-be-in-both-places quirk. Removed the now-stale "no edge gate" caveat from the prior change.
- [x] Update the eBay Developer Portal's registered accepted/declined URLs for the production RuName to the `:8443` callback URL (manual, external step). Done by the user.
- [x] Run OpenSpec validation (46/46), unit tests (185/185), build — all clean.
- [x] Manual functional confirmation: full Production eBay OAuth login through the two-port Tailscale setup, confirming the browser lands back on the primary (port 443) origin after completing — not the funnel port. Confirmed working by the user.
- [ ] Run dual security review (security-review skill + Copilot CLI) after sign-off, then ship via PR.
