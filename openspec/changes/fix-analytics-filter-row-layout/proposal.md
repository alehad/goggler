# Change: Fix Analytics filter row layout when bulk-action buttons appear

## Why

On the Analytics tab, once the "Capture all visible" and/or "Delete all visible" buttons become visible (they're conditional on what's currently in the filtered list), the row containing the capture-status and win-status filter controls loses its layout: the buttons sit as bare children of the same flex row as the two filter control groups, so they end up vertically centered against whatever height that row happens to be (taller when the filter controls wrap onto two lines), and their own text wraps onto two lines rather than staying on one.

## Root Cause

`.section-heading` (the flex row wrapping `.filter-row` and the bulk-action buttons) has no `flex-wrap`, and the two buttons are direct children of it rather than grouped in their own container — unlike every other `.section-heading` usage in this file (e.g. the Home tab, `app/page.tsx:711-731`), which always wraps its action buttons in a `.section-heading-actions` div. That existing class already has `flex-wrap: wrap` and is exactly the container this row was missing.

Confirmed visually with an isolated reproduction of the actual markup/CSS at both narrow and wide viewport widths: the two buttons, as bare `.section-heading` children, either stack as separate full-width rows (narrow) or center awkwardly mid-height next to a two-line-tall filter row with their own text wrapping (wide) — both go away once they're grouped into `.section-heading-actions`, matching how the rest of the app already renders this exact pattern.

## What Changes

- **Superseded first attempt**: grouping the buttons in `.section-heading-actions` (matching the Home tab's pattern) turned out to be wrong for this row specifically — it made the buttons compete with `.filter-row` for space as two separate flex groups, so at the app's real content width they wrapped onto their own column instead of joining the same line as the filter controls. Caught immediately from a live screenshot.
- **Actual fix**: merge the two bulk-action buttons directly into `.filter-row` itself, as siblings of the two `.segmented-control` divs, so all four elements share one flex-wrap group with the full available width. This alone was still ~46px short of fitting on one line at the real content width, so a small, scoped padding override (`.filter-row .segmented-control button { padding: 0 6px; }`) closes the gap — scoped to this one row (not the shared `.segmented-control button` rule) so no other filter UI in the app is affected. See design.md for the exact measurements.

## Out of Scope

- Any change to when these buttons appear (that logic — filtering by captured/not-captured status — is unrelated and already correct).
- Any other `.section-heading` usage in this file (none of the others have this bug; all already group their actions correctly).
