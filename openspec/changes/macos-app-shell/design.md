# Design: Native macOS app — navigation shell and real API connection

## Project layout

```
macos/
  Goggler.xcodeproj/
  Goggler/
    GogglerApp.swift          # @main App entry point
    ContentView.swift         # NavigationSplitView shell
    Networking/
      GogglerAPIClient.swift  # URLSession wrapper
      GogglerEndpoint.swift   # typed request/response definitions, grown incrementally
    Sidebar/
      SidebarItem.swift       # the 4 tabs + Settings, as an enum
      SidebarView.swift
    Tabs/
      HomeView.swift          # first real tab — calls buying-history
      WatchlistView.swift     # placeholder for this phase
      PurchasesView.swift     # placeholder for this phase
      AnalyticsView.swift     # placeholder for this phase
      SettingsView.swift      # placeholder for this phase
```

Xcode project (not a bare Swift package) since this needs a real app bundle, entitlements (network client), and the standard macOS app lifecycle — matching how any real GUI app on this platform is built, and giving access to Xcode's canvas/previews for iterating on the UI.

## Sidebar: NavigationSplitView with a pinned bottom item

`NavigationSplitView`'s sidebar is a normal SwiftUI view, not a special "sidebar list" primitive — so pinning Settings to the bottom, separate from the four scrolling tab items, is a plain layout composition: the main tab list in a `List`, then Settings placed after it with a `Spacer` pushing it down, all inside a `VStack` that fills the sidebar column. This mirrors Claude Code's own sidebar shape (primary navigation top, secondary/settings-style items pinned bottom) without needing any non-standard SwiftUI API.

```swift
enum SidebarItem: String, CaseIterable, Identifiable {
    case home, watchlist, purchases, analytics
    var id: Self { self }
    var label: String { ... }        // "Home", "Watchlist", "Purchases", "Analytics"
    var systemImage: String { ... }  // "house", "heart", "bag", "chart.line.uptrend.xyaxis"
}

struct ContentView: View {
    @State private var selection: SidebarItem? = .home
    @State private var showSettings = false

    var body: some View {
        NavigationSplitView {
            VStack(spacing: 0) {
                List(SidebarItem.allCases, selection: $selection) { item in
                    Label(item.label, systemImage: item.systemImage)
                }
                Spacer()
                Divider()
                Button { showSettings = true } label: {
                    Label("Settings", systemImage: "person.circle")
                }
                .buttonStyle(.plain)
                .padding()
            }
        } detail: {
            switch selection {
            case .home: HomeView()
            case .watchlist: WatchlistView()
            case .purchases: PurchasesView()
            case .analytics: AnalyticsView()
            case nil: ContentUnavailableView("Select a tab", systemImage: "sidebar.left")
            }
        }
        .sheet(isPresented: $showSettings) { SettingsView() }
    }
}
```

(Settings as a sheet rather than a sixth sidebar-selectable item mirrors the web app's own treatment of "My" — reachable, but visually and behaviorally distinct from the four main content tabs. Exact presentation — sheet vs. a dedicated bottom-of-sidebar selection state — is a detail to settle while actually building this, not a load-bearing design decision.)

## `GogglerAPIClient`

```swift
struct GogglerAPIClient {
    let baseURL: URL   // e.g. https://goggler.tailde35d2.ts.net — configurable, not hardcoded

    private let session: URLSession = {
        let config = URLSessionConfiguration.default
        config.httpCookieStorage = .shared   // persists the goggler session cookie across launches
        return URLSession(configuration: config)
    }()

    func request(_ path: String, method: String = "GET", body: Data? = nil) async throws -> (Data, HTTPURLResponse) {
        var request = URLRequest(url: baseURL.appendingPathComponent(path))
        request.httpMethod = method
        request.httpBody = body
        request.setValue(baseURL.absoluteString, forHTTPHeaderField: "Origin")  // satisfies validateSameOriginRequest
        if body != nil {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw GogglerAPIError.invalidResponse }
        return (data, http)
    }
}
```

No auth token handling code needed beyond this — `URLSessionConfiguration.default`'s shared cookie storage does the rest, exactly like a browser tab.

## Why the Home tab's first call is `buying-history`, not something friendlier

It would be easy to make phase 1 "look done" by calling a route that succeeds without eBay auth (e.g. `config-status`) and stopping there. Deliberately not doing that: the whole point of this phase is proving the real, load-bearing pipeline end-to-end, and `buying-history` is what the real Home tab actually needs. Getting a real `409` and rendering it correctly (a native equivalent of the web app's "Buying history unavailable — connect eBay" empty state) is a more honest, more useful milestone than a call that was always going to succeed.

## Testing

No existing test infrastructure applies here — this is a new Swift/Xcode project, not TypeScript. `xcodebuild test` with a small XCTest target covering `GogglerAPIClient` (e.g. against a local mock `URLProtocol`, or directly against the real local `next dev` server for a true integration check) is the natural equivalent of this repo's existing test tiers, added as part of this change rather than deferred. UI verification is manual — run the app, confirm the sidebar/navigation/network-call behavior described in proposal.md's Success Criteria, same spirit as this repo's manual-functional-testing-pause convention for the web app.

## Config: local dev vs. Tailscale

For iterating locally, `baseURL` should point at `http://localhost:3000` (the same `next dev` server used throughout this project) rather than always requiring the Tailscale tunnel to be up. A simple build-configuration or in-app setting toggle between "local" and "Tailscale" is enough for this phase — no need to over-design a full settings/environment system yet.
