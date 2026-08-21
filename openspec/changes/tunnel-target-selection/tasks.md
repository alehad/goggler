# Tasks: Named, startup-selectable tunnel target (default Tailscale)

- [x] Create OpenSpec change documenting the design.
- [x] Wait for user sign-off on this design before implementing.
- [x] Implement `resolveTunnelTarget`/`trustedTunnelHost`/exact-match-aware `isAllowedForwardedOrigin` in `src/http/origin.ts`.
- [x] Update `test/http/origin.test.mjs` for the new exact-match, target-aware behavior. Also fixed two other test files (`test/auth/csrf.test.mjs`, `test/ebay/routes.test.mjs`) that implicitly relied on the old default ngrok-suffix trust.
- [x] Document `GOGGLER_TUNNEL_TARGET`, `GOGGLER_TAILSCALE_HOSTNAME`, `GOGGLER_NGROK_HOSTNAME`, and (previously undocumented) `GOGGLER_ALLOWED_PUBLIC_ORIGINS` in `.env.example`.
- [x] Set `GOGGLER_TAILSCALE_HOSTNAME=goggler.tailde35d2.ts.net` and `GOGGLER_NGROK_HOSTNAME=unrigged-fifth-nastily.ngrok-free.dev` in `.env.local` (local-only, not committed).
- [x] Update AGENTS.md's "Manual Testing Against Production eBay" section: Tailscale Funnel is the default path (with an explicit note on the accepted no-edge-gate exposure gap), ngrok remains available via `GOGGLER_TUNNEL_TARGET=ngrok`.
- [x] Remove the now-unnecessary `GOGGLER_ALLOWED_PUBLIC_ORIGINS=https://goggler.tailde35d2.ts.net` override from `.env.local`.
- [x] Run OpenSpec validation (45/45), unit tests (183/183), build — all clean.
- [x] Manual functional confirmation: Tailscale Funnel + Production eBay OAuth login end to end with `GOGGLER_TUNNEL_TARGET` unset, `GOGGLER_TAILSCALE_HOSTNAME` set, and no `.env.local` origin-allowlist override. Confirmed working by the user.
- [ ] Run dual security review (security-review skill + Copilot CLI) after sign-off, then ship via PR.
