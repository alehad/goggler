# Design: macOS Analytics AI assistant (text chat)

## Shared matching-preferences constant

`BuyingHistoryStore.loadBuyingHistory` currently hardcodes the request body inline:

```swift
jsonBody: ["exactTitleMatch": true, "criteriaText": #"\b[A-Z]{1,5}-?\d{1,6}\b"#]
```

Extracted into a small shared value, `AppDefaults.matchingPreferences` (or similar — final name decided at implementation time), a `[String: Sendable]`-shaped constant used by both `BuyingHistoryStore` (buying-history fetch) and the new chat call, so they can't silently drift apart. This is a pure refactor of the existing call site — no behavior change there.

## `GogglerModels.swift`

```swift
/// Response of `POST /api/market-insights/chat`.
struct ChatAnswer: Decodable, Sendable {
    let answer: String
    let itemIds: [String]
}
```

## `AnalyticsView`

New state:

```swift
@State private var aiQuestion = ""
@State private var aiLoading = false
@State private var aiError: String?
@State private var aiAnswer: String?
@State private var aiFilterItemIds: [String]?
```

New form, inserted in `content(for:)` right after the summary metrics `HStack` and before the search `TextField`:

```swift
HStack(spacing: 8) {
    TextField("Ask about your items, e.g. \"what is the highest paid item?\"", text: $aiQuestion)
        .textFieldStyle(.roundedBorder)
        .onSubmit { Task { await askAssistant() } }
    Button {
        Task { await askAssistant() }
    } label: {
        Text(aiLoading ? "Thinking…" : "Ask")
    }
    .disabled(aiLoading || aiQuestion.trimmingCharacters(in: .whitespaces).isEmpty)
}

if let aiError {
    Text(aiError).foregroundStyle(.secondary)
}

if let aiAnswer {
    VStack(alignment: .leading, spacing: 8) {
        markdownText(aiAnswer)
        if aiFilterItemIds != nil {
            Button("Clear") { clearAiFilter() }
        }
    }
}
```

`askAssistant()`:

```swift
private func askAssistant() async {
    let question = aiQuestion.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !question.isEmpty, !aiLoading, let client = appSettings.apiClient else { return }

    aiLoading = true
    aiError = nil
    defer { aiLoading = false }

    do {
        var body = AppDefaults.matchingPreferences
        body["question"] = question
        let (result, statusCode) = try await client.requestDecoded("/api/market-insights/chat", as: ChatAnswer.self, method: "POST", jsonBody: body)
        guard (200..<300).contains(statusCode) else {
            aiError = "Could not answer that question right now."
            return
        }
        aiAnswer = result.answer
        aiFilterItemIds = result.itemIds
    } catch {
        aiError = "Could not answer that question right now."
    }
}

private func clearAiFilter() {
    aiFilterItemIds = nil
    aiAnswer = nil
    aiError = nil
}
```

(Note: `requestDecoded` — the raw-decode-with-status-code pattern already established and used elsewhere in this file/store — is used here rather than the blind-decode `requestDecoded` variant that throws on non-2xx, matching the already-fixed pattern from `captureItems`'s earlier bug this session, where decoding a non-2xx body as the success type produced a useless generic error. Confirm at implementation time which overload of `requestDecoded`/`request` this codebase actually exposes and use the status-code-checking one.)

Markdown rendering, with graceful fallback:

```swift
@ViewBuilder
private func markdownText(_ raw: String) -> some View {
    if let attributed = try? AttributedString(markdown: raw, options: .init(interpretedSyntax: .inlineOnlyPreservingWhitespace)) {
        Text(attributed)
    } else {
        Text(raw)
    }
}
```

`.inlineOnlyPreservingWhitespace` avoids SwiftUI's block-markdown parser throwing on constructs it doesn't support (tables, etc. — the assistant's answers are typically short prose/lists) while still rendering bold/links/inline code; a plain-text fallback means a parse failure never hides the answer.

## Filtering — extracted to a free function (matching this session's established Swift 6 pattern)

Mirroring `computeAnalyticsItems` (already moved out of `AnalyticsView` earlier this session specifically because a type conforming to `View` gets its `body` requirement's `@MainActor` isolation incorrectly inferred onto the whole type under Swift 6, including unrelated pure functions — confirmed via an actual crash when a unit test called such a method from a background thread), the filtering logic becomes a free function:

```swift
func filterAnalyticsItems(
    _ items: [AnalyticsItem],
    aiFilterItemIds: [String]?,
    captureFilter: AnalyticsView.CaptureFilter,
    winFilter: AnalyticsView.WinFilter,
    searchQuery: String
) -> [AnalyticsItem] {
    if let aiFilterItemIds {
        let byId = Dictionary(uniqueKeysWithValues: items.map { ($0.id, $0) })
        return aiFilterItemIds.compactMap { byId[$0] }
    }

    // ...existing capture/win/search filtering, unchanged...
}
```

`AnalyticsView.filter(_:)` becomes a thin wrapper calling this with its own `@State` values. `CaptureFilter`/`WinFilter` (currently private nested enums) need to become at least `internal` (not necessarily public) for the free function's signature to reference them — or the function takes them as already-resolved booleans/enums defined at file scope instead, whichever reads cleaner at implementation time.

## Testing

- `GogglerTests`: `ChatAnswer` decodes the real response shape.
- `filterAnalyticsItems`: unit tests for the short-circuit behavior — `aiFilterItemIds` set returns exactly those items in that order (including an id with no matching item being silently skipped, matching `compactMap`); `aiFilterItemIds` nil falls through to today's existing capture/win/search filter test coverage, unchanged.
- No test coverage for the network call itself or Markdown rendering (this repo's Swift tests don't mock `URLSession` at the view layer beyond what `BuyingHistoryStoreTests` already does for capture/delete — if that pattern extends cleanly to a chat call, add one; otherwise this is manual-only, consistent with how `EbayAuthService`'s live OAuth exchange is verified manually against Production eBay rather than fully unit-tested).
- Manual functional testing pause: ask a real question against Production data (Tailscale Funnel), confirm the answer renders, confirm the list filters to referenced items, confirm "Clear" restores the normal filtered view.
