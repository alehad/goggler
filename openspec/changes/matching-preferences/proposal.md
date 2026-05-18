# Change: Matching preferences

## Why

Exact listing-title matching is too brittle for record collecting. The strongest identifier is often the catalogue or label code in the listing title, such as `TBM17`, `TBM2005`, `PAP12`, or `PAP2000`.

Users need a small, understandable way to tune matching without turning the app into a rule engine.

## What Changes

- Add matching preferences to `My goggler`.
- Provide an `Exact title match` checkbox.
- Provide a semicolon-separated criteria textbox for catalogue/label code patterns.
- Prepopulate criteria with `TBM\s*\d{1,4}; PAP\s*\d{1,4}`.
- Apply the preferences to live eBay Home-feed matching when refreshing buying history.
- Keep matching deterministic and explainable.

## Out Of Scope

- Persisting preferences to a server database.
- Complex boolean logic or multi-field rule builders.
- AI/image/audio matching.
- Writing any matching decisions back to eBay.
