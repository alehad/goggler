# Tasks: Secure ngrok OAuth gate

- [x] Create OpenSpec change for securing the local ngrok endpoint.
- [x] Add checked-in ngrok Traffic Policy for OAuth-gated local testing.
- [x] Document secure tunnel startup in the production eBay setup guide.
- [x] Document the callback-bypass fallback and when it is acceptable.
- [x] Verify current eBay OAuth state protection covers signature, expiry, session binding where available, and replay protection.
- [x] Test local startup command syntax against the installed ngrok CLI.
- [x] Verify ngrok OAuth login succeeds with the `goggler-dev` auth namespace.
- [x] Manually verify full production eBay OAuth through the full OAuth-gated tunnel.
- [x] Verify callback `code` and `state` preservation and ngrok/goggler cookie coexistence.
- [ ] If full-gate callback preservation fails, manually verify the documented callback fallback.
- [ ] Run OpenSpec validation, tests/build as applicable, audit, and Copilot advisory security review.
