# Project: goggler

## Purpose

goggler helps a user track eBay UK auction items they bid on but did not win, then discover when those items appear again in new active auctions.

## Principles

- Personal-first, but user-aware from day one.
- Spec-driven development using OpenSpec change proposals.
- eBay integration should be isolated behind an adapter layer so other trading venues can be added later.
- Matching should start explainable and deterministic before adding more advanced similarity or AI-assisted matching.
- The dashboard should prioritize reviewable candidate matches over automated decisions.

## Initial Scope

- Local app user model and login/session concept.
- Connect an eBay UK account for a user.
- Import won and not-won buying history.
- Track not-won auction items.
- Search eBay UK for active auction candidates.
- Show candidate relistings in an in-app dashboard.
- Store won-item data for future purchase analytics.

