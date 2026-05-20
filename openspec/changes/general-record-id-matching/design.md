## Design

### Default Criteria

The default criteria should become:

```text
\b[A-Z]{1,5}\d{1,6}\b
```

The expression captures identifiers such as `TBM2541`, `PAP2005`, `BNJ71001`, `ABC123456`, and `X1`, while avoiding identifiers with spaces or separators like `TBM 2541` or `TBM-2541`.

### Matching Behavior

`criteriaMatchForTitle` should continue to apply the user-configured semicolon-separated safe regex list. Matches should be normalized to uppercase and have whitespace/separators stripped defensively, although the new default does not intentionally match spaced/separated identifiers.

`relistingGroupForTitle` should keep preferring criteria matches before exact-title fallback.

### Market-History Search

`catalogueIdForTitle` should use configured criteria first, then the built-in generic record-ID fallback. This keeps old saved user settings from blocking selected-purchase market-history searches for non-TBM/PAP identifiers.

### UX

The My goggler criteria field remains editable. The default text should show the generic criteria so the user can refine it later if it is too broad.

### Risks

Generic alphanumeric identifiers may produce false positives when listing titles contain unrelated codes. Exact-title fallback and editable criteria remain available to refine behavior.
