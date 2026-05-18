## Overview

This change adds a read-only bridge from goggler's Home feed to the corresponding live eBay listing page. It is intentionally narrower than native watchlist mutation: the user remains in control on eBay's site, and goggler refreshes later to observe any watchlist change through the existing `GetMyeBayBuying` read flow.

## Data Flow

1. `GetMyeBayBuying` responses may include listing URLs through Trading API fields such as `ListingDetails.ViewItemURL`.
2. The Trading client parses only trusted public eBay listing URLs and stores them as `itemWebUrl` on normalized item records.
3. `live-history-source` carries `itemWebUrl` into watchlist items and relisting candidates.
4. `home-feed` includes `itemWebUrl` on rows and includes `open_on_ebay` only when a URL is present.
5. The dashboard renders the action as an external link opening in a new tab with `rel="noopener noreferrer"`.

## URL Trust Rules

- Accept only `https:` URLs.
- Accept only public eBay hosts needed for the configured marketplace, initially `www.ebay.co.uk`, `ebay.co.uk`, `www.ebay.com`, and `ebay.com`.
- Reject localhost, private IPs, non-HTTPS URLs, malformed URLs, and non-eBay hosts.
- Do not proxy the URL or include OAuth/session material in it.

## UX

- The row action label should be `View on eBay`.
- The action should be available for active rows, especially relisting candidates not already on the watchlist.
- After the user adds an item on eBay, they can return to goggler and use `Refresh feed` to observe the updated watchlist status.

## Future Native Watchlist Mutation

A later change can add a true `Add to watchlist` action using eBay Trading API `AddToWatchList`. That change should be separate because it introduces write capability, broader OAuth/app review considerations, POST route mutation behavior, confirmation/error states, and a security review focused on account-changing actions.
