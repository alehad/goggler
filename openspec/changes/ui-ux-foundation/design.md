# Design: UI UX foundation

## Visual Direction

The first UI should feel like a focused marketplace companion app for macOS/iPad-style use:

- Clean app shell with persistent navigation.
- Compact, scannable auction cards.
- Neutral surfaces, restrained accent color, and clear status badges.
- Familiar marketplace actions such as search, filters, confirm/reject, and open listing.
- goggler-owned identity rather than a copy of eBay branding.

## Navigation

Initial tabs:

- Dashboard: unresolved candidate relistings.
- Tracking: lost auction items selected for search.
- Won: imported won items and early price statistics.
- Account: local user and eBay connection state.

## Candidate Review

Candidate cards should expose the decision context at a glance:

- Current listing title and seller.
- Original lost bid price and current bid price.
- Time remaining.
- Confidence score.
- Explanation signals.
- Actions to confirm, reject, or open the source listing.

## Mock Data

The mock should use realistic vinyl-record examples because that is the first concrete collection domain. The implementation should keep this data local and disposable.

