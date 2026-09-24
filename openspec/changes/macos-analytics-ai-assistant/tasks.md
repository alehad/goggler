# Tasks: macOS Analytics AI assistant (text chat)

- [x] Create OpenSpec change documenting the design.
- [x] Wait for user sign-off on this design before implementing.
- [x] Extract the hardcoded matching-preferences request body from `BuyingHistoryStore.loadBuyingHistory` into a shared constant (`DefaultMatchingPreferences.requestBody`), reused by the new chat call.
- [x] Add `ChatAnswer: Decodable, Sendable` to `GogglerModels.swift`.
- [x] Extract `filter(_:)`'s logic in `AnalyticsView` into a free function `filterAnalyticsItems(...)` (Swift 6 `@MainActor`-inference precedent — see design.md), adding the `aiFilterItemIds` short-circuit. `CaptureFilter`/`WinFilter` changed from `private` to internal (default) nested types so the free function — and `@testable import Goggler` — can reference them.
- [x] Add the question field, "Ask" button, answer Markdown rendering (with plain-text fallback), error text, and "Clear" action to `AnalyticsView`, wired to the new `askAssistant()`/`clearAiFilter()` methods. Uses the raw-`request()`-plus-status-check pattern (not the blind-decode `requestDecoded`), matching the already-fixed `captureItems` pattern from earlier this session.
- [x] Unit tests: `ChatAnswer` decoding (2 tests); `filterAnalyticsItems`'s `aiFilterItemIds` short-circuit — present-and-reordered, unmatched-id-skipped, and nil-falls-through-to-existing-filters cases (3 tests).
- [x] `xcodegen generate`, `xcodebuild build`, `xcodebuild test` — 35/35 clean (after the security fix below).
- [x] Manual functional testing pause: user confirmed live on real data ("it works").
- [x] Run dual security review (security-review skill + Copilot CLI). **Found and fixed a real MEDIUM finding**: the AI answer echoes seller-controlled eBay listing titles verbatim (per the chat system prompt), and rendering it via `AttributedString(markdown:)` would have turned any `[text](url)`/autolink syntax in a crafted title into a live, tappable SwiftUI link with no host/scheme validation — a phishing vector, unlike the existing `safeEbayImageURL` precedent for images. Fixed by extracting `analyticsAssistantMarkdown(_:)`, which parses then strips the `.link` attribute from every run before rendering (bold/italic/lists still work; nothing is ever tappable). Added 3 tests (explicit link, autolink, plain formatting still renders) directly exercising the fix. Re-ran both reviews clean afterward.
- [x] Ship via PR.
