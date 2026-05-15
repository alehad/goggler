# Design: eBay-first single-user UX

## Current State

The app currently has two visible auth layers:

1. Local goggler sign-in as seeded user `Saja`.
2. eBay OAuth connection from the `My goggler` tab.

This was useful scaffolding while building session security and OAuth state handling. It is now confusing because the user does not need a separate visible goggler account. The meaningful identity is the eBay account whose watchlist and buying history are being read.

## Target UX

The top-right header control becomes the primary eBay account control:

- Disconnected: `Connect eBay`
- Preparing OAuth preflight: `Preparing...`
- Connected with known eBay identity: `<eBay username>`
- Connected without known identity: `Signed into eBay`
- Reauth required: `Reconnect eBay`

The control behaves as a dropdown:

- Disconnected/preparing: clicking starts or prepares the eBay connection flow.
- Connected: clicking opens a small menu with connection status, expiry/remaining time, and `Disconnect eBay`.
- Reauth required: clicking starts eBay reconnect.

The current local-user display (`Saja` / `Not signed in`) should disappear from the main app chrome.

## Internal Session Model

The implementation can keep the existing local session store in the short term, but it should become automatic and invisible:

- The app can create or refresh the single local session automatically when needed.
- eBay OAuth state remains bound to the internal session.
- eBay access/refresh token values remain stored only in server-side session memory.
- Existing CSRF and OAuth replay protections remain in force.

This avoids a risky auth rewrite while aligning the user experience with the product reality.

## eBay Identity

Preferred behavior is to show the connected eBay username in the top-right control. eBay's Commerce Identity API exposes a read-only `GET /commerce/identity/v1/user/` endpoint for authenticated user tokens. Under `commerce.identity.readonly`, the response includes public account profile fields such as `userId` and `username`, with a documented caveat that some developers/users may receive an immutable user ID in place of username.

The implementation should therefore:

- Request or reuse `https://api.ebay.com/oauth/api_scope/commerce.identity.readonly` if available in the configured app scope list.
- Fetch identity after OAuth token exchange using the same session-scoped token storage model.
- Display `username` when eBay returns a useful account name.
- Display `Signed into eBay` when identity lookup fails, username is unavailable, or eBay returns only an immutable identifier.
- Avoid requesting broader personal-data scopes such as name, address, email, or phone for this UX.

## My Tab

`My` should remain, but it should stop being an auth setup screen. Candidate future contents:

- Matching preferences.
- Data/source status.
- Privacy/session notes.
- Production/Sandbox environment status in development.
- App version and diagnostics.

## Open Questions

- Should automatic local session creation happen on initial page load or only when starting eBay connect?
- Should disconnect also clear loaded Home/Watching/Purchases data immediately? The likely answer is yes.
- Should `My` be renamed to `Settings` or kept as `My` for mobile familiarity?
