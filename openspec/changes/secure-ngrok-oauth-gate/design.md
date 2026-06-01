# Design: Secure ngrok OAuth gate for local eBay testing

## Current State

Local production eBay testing uses a reserved ngrok HTTPS endpoint forwarding to `localhost:3000`. The app requires a local goggler session and eBay OAuth connection before returning real data, but the tunnel itself is publicly routable while active.

## Proposed Approach

Add an ngrok Traffic Policy file, for example `ngrok/oauth.yml`, with an `on_http_request` OAuth action. The default policy should require OAuth for every request before forwarding traffic to the local Next.js app:

```yaml
on_http_request:
  - actions:
      - type: oauth
        config:
          provider: google
          auth_id: goggler-dev
```

The policy uses ngrok-managed provider integration by default, so the repository does not need `client_id` or `client_secret` values. The `auth_id` gives this local gate a stable login/logout namespace. If we later bring our own OAuth client, those secrets must stay outside git and be provided through local ngrok configuration or environment-specific secret handling.

Developers should start the tunnel with:

```bash
ngrok http 3000 --traffic-policy-file ngrok/oauth.yml
```

ngrok documents the OAuth Traffic Policy action for `on_http_request`, and its OAuth protection example uses this `--traffic-policy-file` startup pattern.

## eBay OAuth Interaction

The eBay callback is browser-mediated: eBay redirects the user's browser back to `/api/auth/ebay/callback` with `code` and `state`. eBay does not need unauthenticated server-to-server access to the callback route during this flow.

With full tunnel OAuth enabled, the expected sequence is:

1. User opens the ngrok URL.
2. ngrok requires provider OAuth and sets its own tunnel session cookie.
3. User signs into goggler locally if needed.
4. User starts eBay OAuth.
5. eBay redirects the same browser back to the ngrok callback URL.
6. The existing ngrok session allows the callback request through to goggler.
7. goggler validates signed state, exchanges the eBay code, and keeps tokens session-scoped.

The main risk is redirect interruption: if ngrok OAuth challenges the callback request and does not preserve `code` and `state`, the eBay connection can fail. Manual verification must explicitly test the full production eBay connect round trip through the protected tunnel.

## Callback Fallback

If full-gate testing breaks eBay callback preservation, use a path-aware policy that protects all app UI routes but allows `/api/auth/ebay/callback` through. This is acceptable only as a development-tunnel fallback because the callback route already requires a valid signed `state`, rejects replayed states, exchanges short-lived eBay authorization codes server-side, and does not expose token values.

The fallback should be documented separately from the default policy so the safer full-gate option remains the default. The fallback policy file must include an inline comment explaining that the bypass is limited to the eBay callback route and relies on goggler's signed state, expiry, session binding, replay protection, and server-side token exchange.

The fallback should only be used after a concrete full-gate failure, such as:

- The eBay callback returns through ngrok but the `code` or `state` query parameter is missing or changed.
- ngrok's OAuth challenge interrupts the callback redirect and cannot return the browser to the original callback URL.
- The app reports an eBay callback state error that is reproducible only when the ngrok OAuth gate is enabled.

## Security Considerations

- Do not commit ngrok auth tokens, provider client secrets, or local user allowlists containing private accounts unless the user explicitly approves.
- Keep `.env.local` ignored and unchanged.
- Do not treat ngrok OAuth identity as an app user identity.
- Keep app-side CSRF and eBay OAuth state validation unchanged.
- Run deterministic checks and Copilot advisory security review before committing.

## Verification Plan

Before committing the implementation:

1. Confirm the current eBay OAuth state validation still uses a cryptographic signature, expiry/timestamp enforcement, session binding where available, and replay protection.
2. Start the tunnel with the default full OAuth policy.
3. Confirm an anonymous request to the ngrok URL is challenged by the configured provider before app UI access.
4. Complete the full production eBay OAuth flow through the protected tunnel.
5. Confirm the callback request preserves both `code` and `state` in ngrok inspection logs or app-side behavior.
6. Confirm ngrok's session cookie does not interfere with goggler's own session cookie.
7. Use the callback fallback only if the full-gate callback preservation test fails.

## Open Questions

- Which OAuth provider should be the default for the checked-in policy: Google, GitHub, or Microsoft? Google matches the ngrok example and is a reasonable default unless the user prefers another provider.
- Should we restrict the policy to an explicit email/domain allowlist now, or start with provider authentication only and add an allowlist after confirming ngrok's current policy expression syntax and account support?
