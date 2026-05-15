# Change: eBay-first single-user UX

## Why

goggler is a personal app. In practice there will only be one app user, including in a future mobile version. The current visible local sign-in UX creates an unnecessary second identity concept before the user can do the real thing: connect eBay.

The app should treat eBay connection as the primary visible authentication state. A lightweight local session may still exist as an implementation detail for CSRF protection, OAuth state binding, and session-scoped token storage, but the user should not need to understand or manage a separate goggler account.

## What Changes

- Replace the top-right local-user button with an eBay connection dropdown.
- If eBay is not connected, the top-right control should start the eBay connect flow.
- If eBay is connected, the top-right control should show the connected eBay identity when available.
- If the eBay username cannot be fetched or is not available, the top-right control should show `Signed into eBay`.
- The connected state should show the remaining session/token time, either in the dropdown or adjacent status text.
- The dropdown should allow disconnecting from eBay so the user can reconnect with a different eBay account.
- Remove local sign-in/sign-out and eBay connect/disconnect controls from the `My` tab.
- Keep the `My` tab for preferences/settings that are not auth-centric.

## Out Of Scope

- Supporting multiple goggler users.
- Persisting eBay OAuth tokens or refresh tokens at rest.
- Persisting eBay account identity at rest.
- Adding native mobile auth flows.
- Implementing eBay watchlist write actions.
- Removing every internal local-session implementation detail in the same change.

## Success Criteria

- A fresh app session can connect eBay from the top-right control without first visiting `My goggler` for local sign-in.
- The top-right control clearly distinguishes disconnected, connecting/preparing, connected, and reauth-required states.
- Disconnecting eBay from the top-right dropdown clears the session-scoped eBay authorization and returns the app to a disconnected state.
- `My` no longer contains visible local sign-in/sign-out or eBay connect/disconnect rows.
- eBay token values remain session-scoped only and are not exposed to the browser.
