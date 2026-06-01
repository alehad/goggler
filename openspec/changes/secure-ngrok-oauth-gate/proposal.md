# Change: Secure ngrok OAuth gate for local eBay testing

## Why

The reserved ngrok endpoint used for local production eBay OAuth testing is publicly reachable while the tunnel is running. Although goggler has its own local session, eBay OAuth state validation, and session-scoped token handling, the exposed development origin should not allow arbitrary internet visitors to reach the app UI.

ngrok supports Traffic Policy OAuth actions at the tunnel edge. We should add a documented, repeatable way to start the local HTTPS tunnel with an identity-aware access gate before continuing regular production eBay testing.

## What Changes

- Add a checked-in ngrok Traffic Policy file for local development that requires OAuth before requests reach `localhost:3000`.
- Prefer a provider-backed OAuth gate with no app secrets committed to the repository.
- Document how to start the secure tunnel with the policy file.
- Document the expected interaction between ngrok OAuth and the existing eBay OAuth callback flow.
- Include a fallback policy option that protects the app UI while allowing `/api/auth/ebay/callback` through if full-gate callback testing shows query/state preservation problems.
- Keep goggler's own authentication, CSRF, eBay OAuth state validation, and session-scoped token storage unchanged.

## Out Of Scope

- Replacing goggler's local session or eBay OAuth flow with ngrok authentication.
- Persisting eBay tokens at rest.
- Adding production hosting or a permanent custom domain.
- Adding write actions against eBay.
- Committing provider client secrets or local ngrok account credentials.

## Success Criteria

- A developer can start the ngrok tunnel with the OAuth policy using a documented command.
- Anonymous requests to the ngrok URL are redirected to the configured ngrok OAuth provider before the app is reached.
- After ngrok OAuth succeeds, the existing goggler sign-in and eBay production OAuth flow still work.
- The eBay callback returns to the app with `code` and `state` preserved, or the documented callback-bypass fallback is available and justified by the app's signed state validation.
- Security review confirms the policy does not expose secrets and does not weaken existing app-side OAuth or CSRF protections.
