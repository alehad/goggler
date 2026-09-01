import SwiftUI

/// Native port of the web app's "Price history capture" tab (`Analytics` in
/// app/page.tsx), scoped to the list core plus capture/delete — unlike
/// Watchlist/Purchases' read-only-first scoping, this tab's entire point is
/// the capture action, so it's included here. The AI assistant (chat +
/// voice) and the matched-sales price chart are deferred — see
/// macos-analytics-tab/proposal.md.
struct AnalyticsView: View {
    private enum CaptureFilter: String, CaseIterable, Identifiable {
        case all, captured, notCaptured
        var id: Self { self }
        var label: String {
            switch self {
            case .all: return "All"
            case .captured: return "Captured"
            case .notCaptured: return "Not captured"
            }
        }
    }

    private enum WinFilter: String, CaseIterable, Identifiable {
        case all, won, eventuallyWon, neverWon
        var id: Self { self }
        var label: String {
            switch self {
            case .all: return "All"
            case .won: return "Won"
            case .eventuallyWon: return "Eventually won"
            case .neverWon: return "Never won"
            }
        }
    }

    @Environment(AppSettings.self) private var appSettings
    @Environment(BuyingHistoryStore.self) private var store
    @State private var captureFilter: CaptureFilter = .all
    @State private var winFilter: WinFilter = .all
    @State private var searchQuery = ""
    @State private var pendingItemIds: Set<String> = []
    @State private var deletingItemIds: Set<String> = []
    @State private var bulkCapturing = false
    @State private var bulkDeleting = false
    @State private var itemPendingDeleteConfirmation: AnalyticsItem?
    @State private var isBulkDeleteConfirmationPresented = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                header

                switch store.buyingHistoryState {
                case .idle, .loading:
                    ProgressView()
                        .frame(maxWidth: .infinity, alignment: .center)
                        .padding(.top, 40)
                case .reauthRequired:
                    ContentUnavailableView(
                        "eBay not connected",
                        systemImage: "link.circle",
                        description: Text("Connect eBay to view price history.")
                    )
                case .unavailable(let message):
                    ContentUnavailableView(
                        "Buying history unavailable",
                        systemImage: "exclamationmark.triangle",
                        description: Text(message)
                    )
                case .ready(let history):
                    content(for: history)
                }

                Spacer()
            }
            .padding(24)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .confirmationDialog(
            itemPendingDeleteConfirmation.map { "Remove \"\($0.item.title)\" from price history? This can't be undone." } ?? "",
            isPresented: Binding(
                get: { itemPendingDeleteConfirmation != nil },
                set: { if !$0 { itemPendingDeleteConfirmation = nil } }
            ),
            titleVisibility: .visible
        ) {
            Button("Remove", role: .destructive) {
                if let item = itemPendingDeleteConfirmation {
                    deleteOne(item)
                }
                itemPendingDeleteConfirmation = nil
            }
        }
    }

    private var header: some View {
        HStack {
            VStack(alignment: .leading) {
                Text("Analytics")
                    .font(.largeTitle.bold())
                Text("Price history capture")
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Button {
                Task {
                    guard let client = appSettings.apiClient else { return }
                    await store.refresh(using: client)
                }
            } label: {
                Label("Refresh ended items", systemImage: "arrow.clockwise")
            }
        }
    }

    @ViewBuilder
    private func content(for history: BuyingHistory) -> some View {
        let items = computeAnalyticsItems(endedWatchlistItems: history.endedWatchlistItems, wonItems: history.wonItems)
        let capturedCount = items.filter(\.captured).count
        let filteredItems = filter(items)

        HStack(spacing: 16) {
            metric("Items", String(items.count))
            metric("Captured", String(capturedCount))
            metric("Not captured", String(items.count - capturedCount))
        }

        TextField("Search by title or seller", text: $searchQuery)
            .textFieldStyle(.roundedBorder)

        // Analytics tab only: both filter groups and the bulk-action buttons
        // in one row, matching web's `.filter-row`/`.filter-row-actions`
        // (buttons pinned right via a trailing `Spacer()`, the SwiftUI
        // equivalent of `margin-left: auto`).
        HStack(alignment: .center, spacing: 8) {
            Picker("Capture status", selection: $captureFilter) {
                ForEach(CaptureFilter.allCases) { option in
                    Text(option.label).tag(option)
                }
            }
            .pickerStyle(.segmented)
            .labelsHidden()
            .fixedSize()

            Picker("Win status", selection: $winFilter) {
                ForEach(WinFilter.allCases) { option in
                    Text(option.label).tag(option)
                }
            }
            .pickerStyle(.segmented)
            .labelsHidden()
            .fixedSize()

            Spacer()

            if filteredItems.contains(where: { !$0.captured && $0.item.list == "WatchList" }) {
                Button {
                    Task { await captureAllVisible(filteredItems) }
                } label: {
                    Label(bulkCapturing ? "Capturing…" : "Capture all visible", systemImage: "checkmark")
                }
                .disabled(bulkCapturing)
            }
            if filteredItems.contains(where: { $0.captured && $0.item.list == "WatchList" }) {
                Button(role: .destructive) {
                    isBulkDeleteConfirmationPresented = true
                } label: {
                    Label(bulkDeleting ? "Removing…" : "Delete all visible", systemImage: "trash")
                }
                .disabled(bulkDeleting)
                .confirmationDialog(
                    "Remove \(filteredItems.filter { $0.captured && $0.item.list == "WatchList" }.count) item(s) from price history? This can't be undone.",
                    isPresented: $isBulkDeleteConfirmationPresented,
                    titleVisibility: .visible
                ) {
                    Button("Remove", role: .destructive) {
                        Task { await deleteAllVisible(filteredItems) }
                    }
                }
            }
        }

        if filteredItems.isEmpty {
            ContentUnavailableView(
                searchQuery.trimmingCharacters(in: .whitespaces).isEmpty ? "No ended watchlist items" : "No matches",
                systemImage: "chart.line.uptrend.xyaxis",
                description: Text(
                    searchQuery.trimmingCharacters(in: .whitespaces).isEmpty
                        ? "Items you watch on eBay will appear here once their listing ends, so you can capture their final price."
                        : "No items match your search."
                )
            )
        } else {
            VStack(spacing: 0) {
                ForEach(filteredItems) { analyticsItem in
                    AnalyticsRow(
                        analyticsItem: analyticsItem,
                        capturing: pendingItemIds.contains(analyticsItem.id),
                        deleting: deletingItemIds.contains(analyticsItem.id),
                        onCapture: { Task { await captureOne(analyticsItem) } },
                        onDeleteRequested: { itemPendingDeleteConfirmation = analyticsItem }
                    )
                    if analyticsItem.id != filteredItems.last?.id {
                        Divider()
                    }
                }
            }
        }
    }

    private func filter(_ items: [AnalyticsItem]) -> [AnalyticsItem] {
        let captureFiltered: [AnalyticsItem]
        switch captureFilter {
        case .all: captureFiltered = items
        case .captured: captureFiltered = items.filter(\.captured)
        case .notCaptured: captureFiltered = items.filter { !$0.captured }
        }

        let winFiltered: [AnalyticsItem]
        switch winFilter {
        case .all: winFiltered = captureFiltered
        case .won: winFiltered = captureFiltered.filter(\.won)
        case .eventuallyWon: winFiltered = captureFiltered.filter(\.eventuallyWon)
        case .neverWon: winFiltered = captureFiltered.filter { !$0.won && !$0.eventuallyWon }
        }

        let term = searchQuery.trimmingCharacters(in: .whitespaces).lowercased()
        guard !term.isEmpty else { return winFiltered }
        return winFiltered.filter { analyticsItem in
            analyticsItem.item.title.lowercased().contains(term)
                || (analyticsItem.item.sellerUserId?.lowercased().contains(term) ?? false)
        }
    }

    private func metric(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(value).font(.title2.bold())
            Text(label).font(.caption).foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func captureOne(_ analyticsItem: AnalyticsItem) async {
        guard let client = appSettings.apiClient else { return }
        pendingItemIds.insert(analyticsItem.id)
        defer { pendingItemIds.remove(analyticsItem.id) }
        await store.captureItems([analyticsItem.item], using: client)
    }

    private func captureAllVisible(_ visibleItems: [AnalyticsItem]) async {
        guard let client = appSettings.apiClient else {
            AppLog.startup.error("captureAllVisible: appSettings.apiClient is nil")
            return
        }
        let capturable = visibleItems.filter { !$0.captured && $0.item.list == "WatchList" }.map(\.item)
        AppLog.startup.debug("captureAllVisible: visible=\(visibleItems.count, privacy: .public), capturable=\(capturable.count, privacy: .public)")
        guard !capturable.isEmpty else { return }

        bulkCapturing = true
        defer { bulkCapturing = false }
        let result = await store.captureItems(capturable, using: client)
        AppLog.startup.debug("captureAllVisible: result captured=\(result?.captured.count ?? -1, privacy: .public), skipped=\(result?.skipped.count ?? -1, privacy: .public)")
    }

    private func deleteOne(_ analyticsItem: AnalyticsItem) {
        guard let client = appSettings.apiClient else { return }
        deletingItemIds.insert(analyticsItem.id)
        Task {
            defer { deletingItemIds.remove(analyticsItem.id) }
            await store.deleteItems([analyticsItem.id], using: client)
        }
    }

    private func deleteAllVisible(_ visibleItems: [AnalyticsItem]) async {
        guard let client = appSettings.apiClient else { return }
        let deletable = visibleItems.filter { $0.captured && $0.item.list == "WatchList" }.map(\.id)
        guard !deletable.isEmpty else { return }

        bulkDeleting = true
        defer { bulkDeleting = false }
        await store.deleteItems(deletable, using: client)
    }

}

/// Mirrors `app/page.tsx`'s `items` useMemo exactly: ended watchlist items
/// plus any won items not already among them (won-only rows), with
/// `won`/`eventuallyWon` derived from `wonItems`, sorted by `endTime`
/// descending. Deliberately a free function, not a method on `AnalyticsView`
/// — a type conforming to `View` gets its `body` requirement's `@MainActor`
/// isolation implicitly inferred onto the *whole type*, including unrelated
/// static methods, under Swift 6. Confirmed via an actual crash report: this
/// pure, synchronous, UI-independent computation trapped
/// (`EXC_BREAKPOINT`/`dispatch_assert_queue_fail`) the moment a unit test
/// called it from a background test-execution thread, the same class of
/// erroneous-isolation-inference bug already hit and documented for
/// `EbayAuthService`'s completion handler. Free functions aren't affected
/// by a type's protocol conformance, so this has no isolation requirement
/// at all — directly callable from anywhere, including tests.
func computeAnalyticsItems(endedWatchlistItems: [HistoryItem], wonItems: [HistoryItem]) -> [AnalyticsItem] {
    let wonItemIds = Set(wonItems.map(\.itemId))
    let wonGroupIds = Set(wonItems.compactMap(\.relistingGroupId))

    let watchlistRows = endedWatchlistItems.map { item -> AnalyticsItem in
        let won = wonItemIds.contains(item.itemId)
        let eventuallyWon = !won && (item.relistingGroupId.map(wonGroupIds.contains) ?? false)
        return AnalyticsItem(item: item, won: won, eventuallyWon: eventuallyWon)
    }

    let watchlistIds = Set(watchlistRows.map(\.item.itemId))
    let wonOnlyRows = wonItems
        .filter { !watchlistIds.contains($0.itemId) }
        .map { won -> AnalyticsItem in
            var item = won
            item.captured = false
            return AnalyticsItem(item: item, won: true, eventuallyWon: false)
        }

    return (watchlistRows + wonOnlyRows).sorted { analyticsItemEndTimestamp($0.item.endTime) > analyticsItemEndTimestamp($1.item.endTime) }
}

private func analyticsItemEndTimestamp(_ value: String?) -> Date {
    guard let value, let date = ISO8601DateFormatter().date(from: value) else { return .distantPast }
    return date
}

/// `HistoryItem` plus the two flags Analytics derives from `wonItems` —
/// the Swift equivalent of the TS intersection type
/// `AnalyticsItem = HistoryItem & { won, eventuallyWon }`.
struct AnalyticsItem: Identifiable {
    let item: HistoryItem
    let won: Bool
    let eventuallyWon: Bool

    var id: String { item.id }
    var captured: Bool { item.captured ?? false }
}

private struct AnalyticsRow: View {
    let analyticsItem: AnalyticsItem
    let capturing: Bool
    let deleting: Bool
    let onCapture: () -> Void
    let onDeleteRequested: () -> Void

    private var item: HistoryItem { analyticsItem.item }
    private var isWonOnly: Bool { item.list == "WonList" }

    var body: some View {
        HStack(alignment: .top) {
            RecordThumbnail(imageUrl: item.imageUrl, placeholderSystemImage: "chart.line.uptrend.xyaxis")
            VStack(alignment: .leading, spacing: 4) {
                Text(item.title).font(.headline)
                Text(subtitle).font(.caption).foregroundStyle(.secondary)
                HStack(spacing: 6) {
                    statusPill(analyticsItem.captured ? "Captured" : "Not captured", attention: !analyticsItem.captured)
                    if analyticsItem.won { statusPill("Won", attention: false) }
                    if analyticsItem.eventuallyWon { statusPill("Eventually won", attention: true) }
                }
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 4) {
                Text(item.currentPrice.map { formatMoney($0) } ?? "-").font(.headline)
                Text(isWonOnly ? "paid price" : "final price").font(.caption).foregroundStyle(.secondary)
            }
            if !isWonOnly {
                if analyticsItem.captured {
                    Button {
                        onDeleteRequested()
                    } label: {
                        if deleting { ProgressView().controlSize(.small) } else { Label("Remove", systemImage: "trash") }
                    }
                    .disabled(deleting)
                } else {
                    Button {
                        onCapture()
                    } label: {
                        if capturing { ProgressView().controlSize(.small) } else { Label("Add", systemImage: "checkmark") }
                    }
                    .disabled(capturing)
                }
            }
        }
        .padding(.vertical, 10)
    }

    private var subtitle: String {
        var parts = [item.sellerUserId?.trimmingCharacters(in: .whitespaces).nilIfEmpty ?? "Unknown seller"]
        if let endTime = item.endTime, let date = ISO8601DateFormatter().date(from: endTime) {
            parts.append("\(isWonOnly ? "won" : "ended") \(date.formatted(date: .abbreviated, time: .omitted))")
        }
        return parts.joined(separator: " | ")
    }

    /// Matches `.signal`/`.signal.attention` in `app/styles.css` exactly.
    private func statusPill(_ text: String, attention: Bool) -> some View {
        Text(text)
            .font(.system(size: 12, weight: .bold))
            .padding(.horizontal, 8)
            .frame(height: 19)
            .background(attention ? Color(red: 1, green: 0.961, blue: 0.875) : Color(red: 0.945, green: 0.957, blue: 0.969))
            .foregroundStyle(attention ? Color(red: 0.631, green: 0.361, blue: 0.027) : Color(red: 0.204, green: 0.251, blue: 0.314))
            .overlay {
                Capsule().strokeBorder(attention ? Color(red: 0.961, green: 0.824, blue: 0.545) : Color(red: 0.878, green: 0.898, blue: 0.922))
            }
            .clipShape(Capsule())
    }

    private func formatMoney(_ money: Money) -> String {
        money.value.formatted(.currency(code: money.currency))
    }
}

private extension String {
    var nilIfEmpty: String? { isEmpty ? nil : self }
}

#Preview {
    AnalyticsView()
        .environment(AppSettings())
        .environment(BuyingHistoryStore())
}
