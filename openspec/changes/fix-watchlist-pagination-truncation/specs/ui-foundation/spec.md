## ADDED Requirements

### Requirement: Data-completeness warnings are visible to the user

When the live buying-history fetch reports a warning (such as a still-truncated list), the app SHALL show it to the user rather than only logging it server-side.

#### Scenario: A warning is present on the current history

- **GIVEN** `historyState.history.warnings` is non-empty
- **WHEN** the user is on the Dashboard tab
- **THEN** a visible warning banner SHALL be shown summarizing the issue

#### Scenario: No warnings

- **GIVEN** `historyState.history.warnings` is empty or absent
- **WHEN** the user is on the Dashboard tab
- **THEN** no warning banner SHALL be shown
