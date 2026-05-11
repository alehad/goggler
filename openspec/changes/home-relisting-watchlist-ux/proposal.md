# Change: Home relisting watchlist UX

## Why

The Home screen should become the primary action hub for deciding what to do next, not only a static list of likely relistings. Once goggler has imported lost-bid history and can read or model watchlist state, the most useful view is a unified feed showing which lost items have active relisting candidates, which candidates are already on the user's eBay watchlist, and which need action.

This change plans the UX and data shape for that unified Home experience while staying fixture-backed. Real eBay watchlist reads/writes and persistence should follow once the interaction model is clear and the required eBay scopes/endpoints are confirmed.

## What Changes

- Define Home as a unified action feed led by the user's current eBay watchlist, followed by goggler relisting candidates and lost-bid history context.
- Extend fixture data planning to include active watchlist items and relisting candidate items.
- Add tags that distinguish `Lost bid`, `Relisting candidate`, `On eBay watchlist`, `Never won`, `Eventually won`, and app decision states.
- Define Home filters for candidate/watchlist/relisting status.
- Preserve the user's eBay watchlist ordering at the top of Home, including watchlist items unrelated to past bids.
- Define the `Add to eBay watchlist` affordance for relisting candidates that are not already watched.
- Keep the initial add-to-watchlist action non-destructive and fixture/local-state only until the real eBay API operation and scope are confirmed.

## Out Of Scope

- Calling the live eBay watchlist APIs.
- Mutating the user's real eBay watchlist.
- Persisting confirmed/dismissed candidate decisions.
- Implementing relisting matching algorithms.
- Replacing the current fixture buying-history source with database-backed imports.
- Building push notifications or background checks.

## Success Criteria

- The Home design explains how current eBay watchlist items, lost history, watchlist state, and relisting candidates appear together.
- Current eBay watchlist items are shown first in their eBay watchlist order, even when unrelated to past bids.
- Fixture data requirements cover active watchlist items and relisting candidates.
- The UI spec distinguishes already-watched candidates from candidates that can be added to eBay watchlist.
- The first implementation can be fixture-backed without misleading the user into thinking real eBay watchlist mutation has occurred.
- Later live eBay work has clear open questions for endpoint, scope, and mutation behavior.
