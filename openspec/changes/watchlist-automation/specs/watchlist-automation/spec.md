## ADDED Requirements

### Requirement: Discover live auctions matching purchase/price history and add them to the watchlist

The system SHALL support a user-triggered action that discovers currently-live eBay auction listings matching the record/catalogue IDs found in the user's purchased items and historical price records, and adds newly-found matches to the user's eBay watchlist.

#### Scenario: Record IDs are drawn from both purchased items and price history

- **GIVEN** a user has both purchased items (`WonItem`) and historical price records (`MarketPriceRecord`)
- **WHEN** the discovery action runs for that user
- **THEN** it SHALL extract catalogue/record IDs from both sources using the user's configured matching-criteria regex
- **AND** it SHALL search for each unique record ID at most once per run

#### Scenario: Only live auction listings are added

- **GIVEN** a live eBay listing matches a record ID but is fixed-price (Buy It Now), not an auction
- **WHEN** the discovery action evaluates that listing
- **THEN** it SHALL NOT add it to the watchlist

#### Scenario: Category-match heuristic avoids false positives

- **GIVEN** a live listing's title contains a substring that matches a record ID's pattern but belongs to a different category than the source item
- **WHEN** the discovery action evaluates that listing
- **THEN** it SHALL NOT treat it as a match, using the same category-match heuristic already applied to live relisting discovery

#### Scenario: Items already on the watchlist are not re-added

- **GIVEN** a matching live auction listing is already present on the user's eBay watchlist
- **WHEN** the discovery action evaluates it
- **THEN** it SHALL be skipped and counted as already-watched, not re-added or double-counted

#### Scenario: A single item's add failure does not abort the run

- **GIVEN** multiple matching listings are found in one run
- **AND** adding one of them to the watchlist fails
- **WHEN** the discovery action processes the remaining matches
- **THEN** it SHALL continue processing them
- **AND** the final result SHALL report the failed item separately from the successfully added ones

#### Scenario: The number of watchlist additions in a single run is bounded

- **GIVEN** more matching, not-yet-watched listings are found than the configured per-run cap
- **WHEN** the discovery action adds items to the watchlist
- **THEN** it SHALL NOT exceed that cap in a single run

#### Scenario: One record ID cannot consume the whole run's add budget

- **GIVEN** a single record ID has more matching, not-yet-watched live listings than the configured per-record cap (e.g. one seller running many separate auctions of the same pressing)
- **WHEN** the discovery action adds items to the watchlist
- **THEN** it SHALL add at most that per-record cap for that record ID in a single run
- **AND** it SHALL still consider candidates for other record IDs rather than letting the one record ID exhaust the overall per-run cap

#### Scenario: The action is manually triggered

- **GIVEN** the app is not currently deployed anywhere that runs unattended
- **WHEN** a signed-in user with a connected eBay account wants to run discovery
- **THEN** it SHALL be triggerable via a button in the UI
- **AND** it SHALL NOT run automatically on any schedule as part of this change

#### Scenario: Search coverage is not artificially capped

- **GIVEN** a user's combined purchased items and price history yield a large number of unique record IDs
- **WHEN** the discovery action runs
- **THEN** it SHALL search every unique record ID found, not a fixed small subset

#### Scenario: Searches run with bounded concurrency

- **GIVEN** multiple record IDs need to be searched in one run
- **WHEN** the discovery action performs those searches
- **THEN** it SHALL run at most a configured number of searches concurrently, not all at once and not strictly one at a time

#### Scenario: Progress is reported as the run proceeds

- **GIVEN** a discovery run is in progress
- **WHEN** a search completes or an item is added, skipped as already-watched, or fails to add
- **THEN** the system SHALL make that event available to the caller as it happens, not only in a single result returned after the entire run completes

#### Scenario: The trigger lives where its effect is visible

- **GIVEN** the app's Analytics tab only shows auctions that have already ended
- **AND** newly-discovered auctions added by this action are still live, not yet ended
- **WHEN** deciding where to place the trigger for this action in the UI
- **THEN** it SHALL be placed on the Home tab, where currently-live watchlist items are shown

#### Scenario: Newly-added items appear at the top of the live watchlist view immediately

- **GIVEN** a discovery run adds an item to the watchlist
- **WHEN** the user is viewing the Home tab's watchlist view during or after that run
- **THEN** the newly-added item SHALL appear at the top of that view without requiring a manual page reload
