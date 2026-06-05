# Design: Link seller names to eBay seller pages

## Current State

Item rows display condition and seller metadata as plain text, for example:

- condition
- seller user ID

The seller value is sourced from eBay API fields such as `sellerUserId`.

## Proposed Approach

Add a small UI helper that converts a seller user ID into a trusted eBay seller page URL:

```text
https://www.ebay.co.uk/usr/<encoded seller id>
```

The helper must:

- return `undefined` for missing seller IDs
- trim whitespace
- percent-encode the seller ID path segment
- build only a first-party eBay URL

Render seller names with this helper wherever item metadata currently displays the seller next to condition. Use `target="_blank"` and `rel="noreferrer"` for outbound links.

## Verification

- Unit or render-adjacent tests should cover URL generation for normal, spaced, and missing seller names if a suitable test surface exists.
- Existing UI behavior should continue for rows without a seller.
- Run the standard unit/build validation.
