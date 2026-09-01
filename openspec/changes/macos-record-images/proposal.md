# Proposal: Item thumbnail images on macOS

## Why

Watchlist and Purchases rows already carry `imageUrl` (`HistoryItem.imageUrl`, already decoded, already present on every `BuyingHistory` response) but never render it — the web app shows a thumbnail on every equivalent row; macOS shows only text. This was a deliberate, explicit deferral when those tabs shipped ([[macos-watchlist-and-startup-check]], [[macos-purchases-tab]]), not an oversight, but there's no reason to keep deferring it now.

## What Changes

- A `safeEbayImageURL(_:)` helper in the macOS app, a direct Swift port of `src/http/safe-external-url.ts`'s `safeEbayImageUrl` — HTTPS-only, rejects local/private hosts, and restricts to eBay's actual image CDN hosts (`ebayimg.com`/`ebaystatic.com` and subdomains). The web app validates client-side even though the backend already returns eBay-sourced URLs — same defense-in-depth reasoning applies here, arguably more so: a native app's outbound image request isn't sandboxed by browser-style mixed-content/CORS protections the way a web page's `<img>` tag is, so an unvalidated URL could be used to probe internal network addresses from the user's own Mac.
- `WatchlistView` and `PurchasesView`'s row views render a thumbnail (`AsyncImage`, validated URL) when present, falling back to the same placeholder icon already shown when there's no image.

## Out of Scope

- Home tab — it doesn't show individual items today (just aggregate counts), so there's nothing to add an image to yet.
- Any caching strategy beyond `AsyncImage`'s own built-in URL cache.

## Success Criteria

- Watchlist and Purchases rows show real item thumbnails when `imageUrl` is present and passes validation.
- A malformed, non-HTTPS, local/private-host, or non-eBay-CDN URL is never handed to `AsyncImage` — falls back to the placeholder instead, mirroring the web app's own validation exactly.
- No change to `src/`, `app/api/*`, or `app/page.tsx`.
