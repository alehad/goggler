# Tasks: Native macOS app — navigation shell and real API connection

- [x] Create OpenSpec change documenting the design (backend/frontend separation audit, sidebar shape, networking approach).
- [x] Wait for user sign-off on this design before implementing.
- [x] **Blocked on user**: full Xcode.app installed (only Command Line Tools are currently present — `xcodebuild`, project templates, and SwiftUI previews all need the full IDE).
- [x] Create the Xcode project at `macos/Goggler/` (SwiftUI App, macOS platform, deployment target macOS 15.0).
- [x] Implement `SidebarItem` enum and the `NavigationSplitView` shell (`ContentView.swift`), with Settings pinned at the bottom of the sidebar.
- [x] Implement `GogglerAPIClient` (shared cookie storage, explicit `Origin` header, basic request/response handling).
- [x] Implement `HomeView` calling `GET /api/auth/ebay/config-status`, `GET /api/auth/ebay/session`, and `POST /api/ebay/buying-history`, rendering the real response (including a real `409` as a "not connected" state).
- [x] Placeholder views for Watchlist, Purchases, Analytics, and Settings (not yet functional — this phase is the shell + one real call).
- [x] Add a local-dev vs. Tailscale base-URL toggle (build config or simple in-app setting).
- [x] Add an XCTest target covering `GogglerAPIClient` against a running local backend. (Swift Testing, not XCTest — same coverage: request-building, decoding, status codes, JSON body.)
- [x] `xcodebuild build` and `xcodebuild test` clean.
- [x] Manual functional confirmation (user): launch the app, confirm sidebar navigation and the Success Criteria in proposal.md, against the real local dev server (`npm run dev`) and/or Tailscale.
- [x] Run dual security review (security-review skill + Copilot CLI) on the new Swift code, then ship via PR — noting this is new territory (no prior Swift changes in this repo's review history), so the review should pay particular attention to network/cookie/URL handling correctness even though the change is additive and doesn't touch the existing backend.
