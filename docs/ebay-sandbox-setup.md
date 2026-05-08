# eBay Sandbox Setup

Use this guide when the eBay Developer Program account is active and ready for Sandbox configuration.

## Goal

Validate the existing goggler OAuth connection flow against eBay Sandbox before using Production credentials or implementing buying-history import.

The flow to prove:

1. Sign into goggler locally.
2. Click Connect on the Account tab.
3. Redirect to eBay Sandbox consent.
4. Sign in with an eBay Sandbox test user.
5. Return to `http://localhost:3000/api/auth/ebay/callback`.
6. Confirm goggler shows eBay connected for the current session.

## Developer Portal Setup

In the eBay Developer portal:

1. Open Account > Application Keys.
2. Create or select an application.
3. Create or view the Sandbox keyset.
4. Copy the Sandbox App ID / Client ID.
5. Copy the Sandbox Cert ID / Client Secret.
6. Configure OAuth / eBay Sign-In for the Sandbox keyset.
7. Configure the local callback URL:

```text
http://localhost:3000/api/auth/ebay/callback
```

8. Copy the Sandbox RuName / redirect value eBay provides.
9. Copy the Sandbox OAuth scope string from eBay's User Tokens / sample request page.
10. Create at least one Sandbox test user.

## Local Environment

Create `.env.local` from `.env.example` and fill these values:

```bash
DATABASE_URL=
GOGGLER_AUTH_SECRET=<32+ character local secret>
EBAY_ENVIRONMENT=sandbox
EBAY_CLIENT_ID=<Sandbox App ID / Client ID>
EBAY_CLIENT_SECRET=<Sandbox Cert ID / Client Secret>
EBAY_REDIRECT_URI=<Sandbox RuName / redirect value>
EBAY_OAUTH_SCOPES=<scope string from eBay>
EBAY_MARKETPLACE_ID=EBAY_GB
EBAY_TRADING_SITE_ID=3
```

Do not commit `.env.local`.

## Local Test

1. Run `npm run dev`.
2. Open `http://localhost:3000`.
3. Go to Account.
4. Sign into goggler as the local seeded user.
5. Confirm the eBay row no longer reports missing config.
6. Click Connect.
7. Complete eBay Sandbox consent.
8. Confirm goggler returns to the app and reports eBay connected for this session.

## Notes

- eBay OAuth token values are session-scoped only. They are not persisted at rest.
- If the dev server behaves oddly after `npm run build`, stop it, delete `.next`, and restart `npm run dev`.
- If eBay rejects the redirect URI, verify whether `EBAY_REDIRECT_URI` should be the RuName value rather than the literal localhost callback URL.
- Buying-history import is intentionally out of scope until Sandbox OAuth connect works end to end.
