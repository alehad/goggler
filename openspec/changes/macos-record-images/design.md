# Design: Item thumbnail images on macOS

## `safeEbayImageURL`

Direct port of `src/http/safe-external-url.ts`'s validation chain, kept in a new `Networking/SafeExternalURL.swift`:

```swift
func safeEbayImageURL(_ value: String?) -> URL? {
    guard let value, let components = URLComponents(string: value), components.scheme == "https", let host = components.host else {
        return nil
    }
    let normalizedHost = host.lowercased()
    guard !isLocalOrPrivateHost(normalizedHost) else { return nil }
    guard normalizedHost == "ebayimg.com" || normalizedHost.hasSuffix(".ebayimg.com")
        || normalizedHost == "ebaystatic.com" || normalizedHost.hasSuffix(".ebaystatic.com") else {
        return nil
    }
    return components.url
}
```

`isLocalOrPrivateHost` mirrors the TS version's checks: `localhost`/`*.localhost`, anything containing `:` (IPv6), and the standard private IPv4 ranges (`10.0.0.0/8`, `127.0.0.0/8`, `169.254.0.0/16`, `172.16.0.0/12`, `192.168.0.0/16`).

Unlike the TS version, this doesn't need to strip userinfo/hash from the URL — `AsyncImage` only ever GETs the URL, doesn't render it as a clickable link, so there's no equivalent surface for a misleading display string to matter.

## Row rendering

`WatchlistView`'s `HistoryItemRow` and `PurchasesView`'s `PurchaseRow` gain a leading thumbnail:

```swift
if let url = safeEbayImageURL(item.imageUrl) {
    AsyncImage(url: url) { image in
        image.resizable().aspectRatio(contentMode: .fill)
    } placeholder: {
        placeholderIcon
    }
    .frame(width: 44, height: 44)
    .clipShape(RoundedRectangle(cornerRadius: 6))
} else {
    placeholderIcon
}
```

`placeholderIcon` matches each view's existing empty-state iconography (`gavel` for Watchlist, `shippingbox` for Purchases) so a missing/invalid image degrades to something already established as this app's visual language, not a blank box.

## Testing

Unit tests for `safeEbayImageURL` mirroring `safe-external-url.ts`'s own test coverage: accepts a real `ebayimg.com`/`i.ebayimg.com` HTTPS URL, rejects `http://`, rejects a private/local host, rejects a non-eBay host, rejects a malformed string, handles `nil`.
