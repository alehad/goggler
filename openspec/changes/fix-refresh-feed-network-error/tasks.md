# Tasks: Fix "Refresh feed" hanging forever on a network-level failure

- [x] Create OpenSpec change documenting the root cause and fix.
- [x] Confirm today's specific trigger (torn-down Tailscale tunnel/dev server after the previous change shipped) is resolved — restored both, confirmed the backend responds correctly (409 for no session, as expected).
- [x] Wrap `refreshBuyingHistory`'s `fetch` call in `try`/`catch` in `app/page.tsx`, falling back to `previousHistory` if present, otherwise an `"unavailable"` state with a clear message.
- [x] `npx tsc --noEmit`, `npm run build` (dev server stopped first), `npm run test:unit` (195 passing) — all clean.
- [x] Manual confirmation: stopped the dev server, clicked "Refresh feed" — reproduced the exact reported hang, then confirmed the fix shows "Could not reach the server. Check your connection and try again." immediately instead. Restarted the server and confirmed the normal 409 reauth-required path is unchanged.
- [ ] Flag the other five fetch calls in `app/page.tsx` with the same missing-`try`/`catch` gap (`refreshEbayConfigStatus`, `refreshEbaySessionState`, `disconnectEbay`, `executeHomeSearch`, `captureVenueItems`) as a follow-up task, not fixed in this change.
- [ ] Run dual security review (security-review skill + Copilot CLI), then ship via PR.
