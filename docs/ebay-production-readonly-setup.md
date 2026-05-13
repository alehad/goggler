# eBay Production Read-Only Setup

Use this guide after Sandbox OAuth has been verified and you are ready to test against a real eBay account.

## Goal

Validate real eBay read-only retrieval for:

1. Watchlist items.
2. Lost buying-history items.
3. Won buying-history items.
4. The Home feed ordering and tags built from those lists.

This does not add items to the eBay watchlist and does not persist eBay token values at rest.

## Developer Portal Setup

In the eBay Developer portal:

1. Open Account > Application Keys.
2. Select the `Goggler` application.
3. Create or view the Production keyset.
4. Copy the Production App ID / Client ID.
5. Copy the Production Cert ID / Client Secret.
6. Configure OAuth / eBay Sign-In for the Production keyset.
7. Add the HTTPS callback URL that will be used for local testing, for example:

```text
https://<your-ngrok-domain>/api/auth/ebay/callback
```

8. Copy the Production RuName / redirect value eBay provides.
9. Copy the Production OAuth scope string from eBay's User Tokens / sample request page.

## Local Environment

Set production-specific values in `.env.local`:

```bash
EBAY_ENVIRONMENT=production
EBAY_PRODUCTION_CLIENT_ID=<Production App ID / Client ID>
EBAY_PRODUCTION_CLIENT_SECRET=<Production Cert ID / Client Secret>
EBAY_PRODUCTION_REDIRECT_URI=<Production RuName / redirect value>
EBAY_PRODUCTION_OAUTH_SCOPES=<production scope string from eBay>
EBAY_MARKETPLACE_ID=EBAY_GB
EBAY_TRADING_SITE_ID=3
GOGGLER_EBAY_HISTORY_SOURCE=live
```

Keep `GOGGLER_AUTH_SECRET` set to a strong 32+ character local secret. Do not commit `.env.local`.

Production mode intentionally does not fall back to Sandbox credential values.

## Local Test Through HTTPS

1. Start the Next dev server with the production read-only environment.
2. Start ngrok against port `3000`.
3. Confirm the ngrok HTTPS domain matches the callback URL configured in the eBay Production keyset.
4. Open the app through the ngrok HTTPS URL.
5. Sign into goggler locally.
6. Open My goggler and confirm the eBay row does not report missing Production config.
7. Click Connect.
8. Complete real eBay OAuth consent.
9. Confirm the app returns through the ngrok callback and loads the Home feed from live read-only eBay data.

## Safety Notes

- eBay access and refresh token values stay in server-side session memory only.
- `GOGGLER_EBAY_HISTORY_SOURCE=live` is required to read real eBay data.
- eBay watchlist mutations remain out of scope until a separate write-action change is reviewed.
