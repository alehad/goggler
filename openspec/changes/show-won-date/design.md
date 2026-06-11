# Design: Show won date on won-item rows

## Data Source

Use the existing normalized won-item `endTime` field:

- live `WonList` and `GetOrders` items already map their best available purchase/won timestamp to `endTime`
- persisted won items already map `purchasedAt` back to `endTime`
- no persistence, adapter, or route-contract change is required

## Display Behavior

For won items only, add a compact metadata value:

```text
won: <localized absolute date>
```

Examples may render as `won: 3 May 2026` under the current British locale, but tests should verify behavior without depending unnecessarily on one machine's exact punctuation.

The date should appear in the same metadata line as condition and seller:

```text
Used · facerecords · won: 3 May 2026
```

Existing metadata layout conventions should be preserved. On narrow screens, the metadata line may wrap naturally without overlapping adjacent content.

## Affected Views

- Home feed rows whose section is `won`
- dedicated Purchases won-item list

Do not add won dates to:

- lost/never-won/eventually-won rows
- current watchlist rows
- relisting candidates
- live search results

## Date Formatting

Add or reuse a small formatter that:

- accepts the optional ISO-style timestamp
- validates the parsed date
- returns an absolute localized date with day, abbreviated month, and year
- returns no value for missing or invalid dates

Do not use relative labels such as `2 months ago`, because purchase history should remain stable and immediately comparable.

## Verification

- Add deterministic formatter or rendering-oriented coverage for valid, missing, and invalid won timestamps.
- Confirm both Home won rows and Purchases rows receive the date.
- Confirm non-won rows do not receive it.
- Run unit tests, TypeScript checks, OpenSpec validation, production build, and visual verification against production eBay data.
