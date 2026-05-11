# Design: Fixture history UI

## Overview

The fixture history mode is a temporary development bridge between OAuth connection and database-backed imports. It preserves the real local sign-in and eBay connection flow, then swaps the buying-history backend for deterministic fixture data once the session is connected.

This lets UX work continue against realistic item counts and relisting relationships without prematurely committing to persistence tables or import-run behavior.

## History Source Configuration

Introduce `GOGGLER_EBAY_HISTORY_SOURCE`:

- `fixture`: serve deterministic local fixture data.
- `live`: reserve the path for real Trading API/import behavior.

If unset, the app should default to `fixture` in development and `live` in production. Fixture mode must fail closed in production so test data cannot accidentally appear in a deployed app.

## API Boundary

Add a server route for buying-history reads. The route should:

- Require the local goggler session.
- Require an active session-scoped eBay authorization.
- Return fixture history only when the configured source is `fixture`.
- Return a clear not-implemented response for `live` until real import work is added.
- Never return OAuth access tokens, refresh tokens, client secrets, or raw eBay request material.

Keeping this behind a server route avoids importing development fixtures directly into the client as the long-term interface. Later work can keep the same client contract while replacing the server implementation with live import state and persisted records.

## UI Behavior

The app should consume the history route from the Watching and Purchases tabs:

- Watching shows lost bid items.
- Purchases shows won items.
- Watching includes a segmented filter for all lost bids, never won, and eventually won.
- Summary metrics should reflect the loaded fixture data.
- When the user has not connected eBay, history areas should show a concise connection prompt rather than mock rows.

The UI may show a development-only source marker such as "Fixture history" when fixture mode is active, but it should not be presented as a production feature.

## Relisting Relationship

The fixture data uses a local `relistingGroupId` to model items that appear again after a lost bid. eBay item ids remain distinct between lost and won listings. The first UX filter uses that relationship to answer: "Which lost bid items did I never later win?"

## Production Guardrail

Fixture mode is explicitly development-only. If production runtime configuration requests fixture data, the server should reject it rather than silently serving test data.
