## ADDED Requirements

### Requirement: Captured price-history records can be removed individually or in bulk

The system SHALL allow a signed-in user to permanently remove a captured price-history record (`MarketPriceRecord`), either one at a time or in bulk for a set of currently-visible items, from the Analytics tab.

#### Scenario: Individual removal

- **GIVEN** a captured price-history item is shown on the Analytics tab
- **WHEN** the user confirms removing it
- **THEN** its `MarketPriceRecord` row SHALL be permanently deleted
- **AND** it SHALL no longer appear in the Analytics list without requiring a page reload

#### Scenario: Bulk removal targets exactly what's visible

- **GIVEN** the Analytics tab's search text and filter dropdowns narrow the visible list to a subset of items
- **WHEN** the user triggers bulk removal and confirms
- **THEN** only the currently-visible, captured items SHALL be removed
- **AND** items excluded by the current search/filter state SHALL NOT be removed

#### Scenario: Purchases are never removable through this feature

- **GIVEN** an Analytics list item represents an actual purchase (`WonItem`) with no corresponding captured price-history record
- **WHEN** the Analytics list is rendered
- **THEN** no removal action SHALL be offered for that item
- **AND** no removal request SHALL be able to delete a `WonItem` row

#### Scenario: Removal requires confirmation

- **GIVEN** the user triggers either individual or bulk removal
- **WHEN** the action would take effect
- **THEN** the system SHALL require explicit confirmation, stating what will be removed, before deleting anything

#### Scenario: Removal is scoped to the requesting user

- **GIVEN** a removal request specifies one or more item IDs
- **WHEN** the system processes that request
- **THEN** it SHALL only delete records owned by the requesting user
- **AND** it SHALL NOT be possible to delete another user's records by specifying their item IDs
