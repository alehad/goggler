## MODIFIED Requirements

### Requirement: Captured price-history records can be removed individually or in bulk

The system SHALL allow a signed-in user to remove a captured price-history record (`MarketPriceRecord`), either one at a time or in bulk for a set of currently-visible items, from the Analytics tab. Removal SHALL be a soft delete — the record SHALL be marked removed (via a `deletedAt` timestamp) rather than physically deleted, and remains recoverable in the database, but SHALL be treated as non-existent by every other read path in the system, including capture-status checks, relisting-group price averages and matched-sales history, the AI assistant's captured-items context, and watchlist automation.

#### Scenario: Individual removal

- **GIVEN** a captured price-history item is shown on the Analytics tab
- **WHEN** the user confirms removing it
- **THEN** its `MarketPriceRecord` row SHALL be marked soft-deleted
- **AND** it SHALL no longer appear in the Analytics list without requiring a page reload

#### Scenario: Bulk removal targets exactly what's visible

- **GIVEN** the Analytics tab's search text and filter dropdowns narrow the visible list to a subset of items
- **WHEN** the user triggers bulk removal and confirms
- **THEN** only the currently-visible, captured items SHALL be soft-deleted
- **AND** items excluded by the current search/filter state SHALL NOT be affected

#### Scenario: Purchases are never removable through this feature

- **GIVEN** an Analytics list item represents an actual purchase (`WonItem`) with no corresponding captured price-history record
- **WHEN** the Analytics list is rendered
- **THEN** no removal action SHALL be offered for that item
- **AND** no removal request SHALL be able to delete a `WonItem` row

#### Scenario: Removal requires confirmation

- **GIVEN** the user triggers either individual or bulk removal
- **WHEN** the action would take effect
- **THEN** the system SHALL require explicit confirmation, stating what will be removed, before soft-deleting anything

#### Scenario: Removal is scoped to the requesting user

- **GIVEN** a removal request specifies one or more item IDs
- **WHEN** the system processes that request
- **THEN** it SHALL only soft-delete records owned by the requesting user
- **AND** it SHALL NOT be possible to soft-delete another user's records by specifying their item IDs

#### Scenario: A soft-deleted record is excluded from price averages and matched sales

- **GIVEN** a `MarketPriceRecord` has been soft-deleted
- **WHEN** its relisting group's price average or matched-sales history is computed
- **THEN** the soft-deleted record SHALL NOT be included

#### Scenario: A soft-deleted record reads as not captured

- **GIVEN** a `MarketPriceRecord` has been soft-deleted
- **WHEN** its capture status is checked (Analytics list, AI assistant context, watchlist automation)
- **THEN** the item SHALL be treated as not captured

#### Scenario: Re-capturing a soft-deleted item revives it

- **GIVEN** a `MarketPriceRecord` has been soft-deleted
- **WHEN** the same item (same `venueItemId`) is captured again
- **THEN** the existing row SHALL be revived (its `deletedAt` cleared and fields refreshed) rather than a new row created
- **AND** the item SHALL immediately be treated as captured everywhere again
