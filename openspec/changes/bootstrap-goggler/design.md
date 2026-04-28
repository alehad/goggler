# Design: Bootstrap goggler

## Overview

goggler is a personal-first web app for tracking eBay UK auction items that may be relisted after the user loses an auction. The initial system should be simple enough to build iteratively, while keeping integration boundaries clear.

## Recommended Stack

- TypeScript end-to-end.
- Next.js for the web app, dashboard, and server-side routes.
- PostgreSQL for durable storage.
- Prisma for schema management and database access.
- A minimal local authentication layer or Auth.js, selected during application scaffolding.
- Background jobs implemented first as scheduled scripts or a simple worker process.

## User Model

The app is single-user in intent, but data should belong to an app `User`.

The first version should support:

- Local login/session.
- One connected eBay account per user.
- User-owned imported auctions, tracked items, candidate listings, search runs, and match decisions.

This avoids a later data ownership rewrite if multiple local users are needed.

## Trading Venue Adapter Layer

eBay-specific behavior should sit behind a venue adapter boundary. The rest of the app should work with internal domain concepts, not raw eBay API responses.

Initial adapter responsibilities:

- Authenticate or refresh eBay access for a user.
- Import buying history from eBay UK.
- Normalize won and not-won auction records.
- Search active eBay UK auctions for candidate listings.
- Normalize active listing records for matching and dashboard review.

Future adapters could support other venues such as Craigslist or specialist marketplaces.

## eBay Integration

Initial research indicates a hybrid eBay integration may be required:

- Trading API `GetMyeBayBuying` for authenticated buying history, including won and not-won items.
- Buy Browse API for active listing discovery.

This must be validated again during implementation because eBay API availability, scopes, and marketplace support can change.

## Matching V1

The first matching strategy should be deterministic and explainable.

Signals may include:

- Normalized title similarity.
- Category match.
- Item condition.
- Price range.
- Seller or location hints.
- Vinyl-specific tokens where present, such as artist, title, label, catalogue number, pressing, and format.

The dashboard should show why a candidate was suggested. The user remains the final decision maker.

## Future Purchase Analytics

Won-item import should be included early so later analytics can be built without reworking ingestion.

Future analytics may include:

- Won items list.
- Highest price paid.
- Lowest price paid.
- Median price paid.
- Total spend.
- Breakdowns by category, time period, or search/tracking group.

