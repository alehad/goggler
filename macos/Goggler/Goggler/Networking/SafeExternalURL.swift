import Foundation

/// Direct Swift port of `src/http/safe-external-url.ts`'s `safeEbayImageUrl` —
/// HTTPS-only, restricted to eBay's actual image CDN hosts, rejects
/// local/private hosts. The web app validates client-side even though the
/// backend already returns eBay-sourced URLs; the same defense-in-depth
/// applies here, arguably more so — a native app's outbound image request
/// isn't sandboxed by browser-style mixed-content/CORS protections the way
/// a web page's `<img>` tag is, so an unvalidated URL could be used to
/// probe internal network addresses from the user's own Mac.
func safeEbayImageURL(_ value: String?) -> URL? {
    guard let value,
          var components = URLComponents(string: value),
          components.scheme == "https",
          let host = components.host
    else {
        return nil
    }

    let normalizedHost = host.lowercased()
    guard !isLocalOrPrivateHost(normalizedHost) else { return nil }
    guard isTrustedEbayImageHost(normalizedHost) else { return nil }

    // Matches the TS original's stripping of userinfo/hash — not a known
    // exploit path for AsyncImage (a plain GET, no display-text use of the
    // URL), but free to do and keeps the two implementations in lockstep.
    components.user = nil
    components.password = nil
    components.fragment = nil

    return components.url
}

private func isTrustedEbayImageHost(_ hostname: String) -> Bool {
    hostname == "ebayimg.com" || hostname.hasSuffix(".ebayimg.com")
        || hostname == "ebaystatic.com" || hostname.hasSuffix(".ebaystatic.com")
}

private func isLocalOrPrivateHost(_ hostname: String) -> Bool {
    if hostname == "localhost" || hostname.hasSuffix(".localhost") || hostname.contains(":") {
        return true
    }

    let parts = hostname.split(separator: ".", omittingEmptySubsequences: false).map { Int($0) }
    guard parts.count == 4, let first = parts[0], let second = parts[1],
          parts.allSatisfy({ if let value = $0 { return (0...255).contains(value) } else { return false } })
    else {
        return false
    }

    return first == 10
        || first == 127
        || (first == 169 && second == 254)
        || (first == 172 && (16...31).contains(second))
        || (first == 192 && second == 168)
}
