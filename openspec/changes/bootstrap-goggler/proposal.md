# Change: Bootstrap goggler

## Why

The project needs a clear, spec-led foundation before application code is scaffolded. goggler will start as a personal app, but it should have enough structure to support user-specific data, authenticated eBay access, and future expansion to other trading venues.

## What Changes

- Define the initial product shape for a personal eBay UK auction tracking dashboard.
- Introduce a user-aware data ownership model from the start.
- Specify an eBay adapter layer that imports buying history and searches current active auctions.
- Track not-won auction items and surface possible exact relistings.
- Import won items for later analytics, without making analytics part of the first dashboard workflow.
- Establish an implementation plan for a modern TypeScript application.

## Out Of Scope

- Multi-user SaaS behavior.
- Public registration and account management.
- Mobile push, email, or external notifications.
- Similar-item recommendations beyond likely exact relistings.
- Image similarity and AI-assisted matching.
- Non-eBay marketplaces such as Craigslist.

## Success Criteria

- A user can sign in locally and connect an eBay UK account.
- The app can import eBay buying history for won and not-won items.
- A user can choose not-won items to track.
- The app can search eBay UK active auctions for candidate relistings.
- The dashboard shows candidate matches with explainable confidence signals.
- Match decisions are stored for later refinement.

