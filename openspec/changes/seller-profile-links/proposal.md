# Proposal: Link seller names to eBay seller pages

## Why

The Home and Purchases item rows already show seller names after item condition. Linking those seller names to eBay makes the row more useful without adding another control or changing the data model.

## What Changes

- Render known seller names as links to eBay seller pages.
- Keep unknown sellers as plain text.
- Open seller links in a new tab/window.
- Use a locally constructed trusted eBay URL rather than accepting seller URLs from upstream data.

## Impact

- Affected UI: Home rows, Purchases rows, and any existing item detail rows that display seller names.
- No OAuth scope changes.
- No persistent storage changes.
