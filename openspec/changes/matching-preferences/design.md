# Design: Matching preferences

## Preference Model

The initial preference model should stay small:

- `exactTitleMatch`: boolean, default `true`.
- `criteriaText`: semicolon-separated regex fragments, default `TBM\s*\d{1,4}; PAP\s*\d{1,4}`.

Preferences can live in browser local storage for now because they are UX tuning state, not account secrets. The values are sent in the buying-history refresh request body so the server-side live history source can apply them while building relisting groups without exposing criteria in the URL.

## Matching Behavior

For each eBay item title:

1. Try each configured regex criterion against the title, case-insensitively.
2. Normalize the matched criterion value by trimming, uppercasing, and removing whitespace.
3. Use the first matched criterion as a catalogue-code relisting group.
4. If no criterion matches and exact title matching is enabled, fall back to normalized exact title.
5. If neither matches, leave the item without a relisting group.

Criteria matches should take precedence over exact title matches because catalogue IDs are more stable than seller wording.

Invalid regex criteria should be ignored rather than breaking refresh.

Criteria are user-editable regex fragments, so matching should apply defensive bounds: limit total criteria text length, limit each individual criterion length, limit the number of compiled criteria, reject unsafe regex fragments, and match against a bounded title string.

## UI

The `My goggler` page should replace the placeholder matching row with:

- a checkbox for exact title matching
- a textarea/input for semicolon-separated criteria
- succinct status copy showing that preferences apply to the next refresh

The app should avoid exposing raw implementation detail beyond the criteria text itself.
