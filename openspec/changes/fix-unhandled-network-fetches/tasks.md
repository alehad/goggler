# Tasks: Fix remaining unhandled network-level fetch failures in app/page.tsx

- [x] Create OpenSpec change documenting the root cause and fix for all five deferred functions.
- [x] Wrap `refreshEbayConfigStatus`'s `fetch` in `try`/`catch`, falling back to `null` on network failure (same as its existing non-`ok` branch).
- [x] Wrap `refreshEbaySessionState`'s `fetch` in `try`/`catch`, falling back to `null` on network failure (same as its existing non-`ok` branch).
- [x] Wrap `disconnectEbay`'s `fetch` in `try`/`catch`, setting `accountMessage` to `"Could not disconnect eBay: network error"` on network failure.
- [x] Wrap `executeHomeSearch`'s `fetch` in `try`/`catch`, setting `homeSearchState` to `{ status: "unavailable", query, message: "Could not reach the server. Check your connection and try again." }` on network failure.
- [x] Wrap `captureVenueItems`'s `fetch` in `try`/`catch`, setting `message` to `"Could not capture price history for this item: network error"` on network failure.
- [x] `npx tsc --noEmit`, `npm run build` (dev server stopped first), `npm run test:unit` (195 passing) — all clean.
- [ ] Manual confirmation per function: stop the dev server, exercise each control (reload for the two polling functions, click Disconnect, submit a search, capture an item), confirm each shows a message/fallback instead of hanging or silently failing. Restart the server and confirm normal (success and existing non-`ok`) paths are unchanged for all five.
- [ ] Run dual security review (security-review skill + Copilot CLI), then ship via PR.
