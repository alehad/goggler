import SwiftUI

/// Native port of the web app's "Watching" tab (`Tracking` in app/page.tsx):
/// tracked lost auctions from the shared `BuyingHistoryStore`, filterable by
/// whether they were eventually won through a relisting.
struct WatchlistView: View {
    private enum LostFilter: String, CaseIterable, Identifiable {
        case all, neverWon, eventuallyWon
        var id: Self { self }
        var label: String {
            switch self {
            case .all: return "All"
            case .neverWon: return "Never won"
            case .eventuallyWon: return "Eventually won"
            }
        }
    }

    @Environment(AppSettings.self) private var appSettings
    @Environment(BuyingHistoryStore.self) private var store
    @State private var filter: LostFilter = .all

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
                        description: Text("Connect eBay to view tracked auctions.")
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
    }

    private var header: some View {
        HStack {
            VStack(alignment: .leading) {
                Text("Watchlist")
                    .font(.largeTitle.bold())
                Text("Tracked lost auctions")
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Button {
                Task {
                    guard let client = appSettings.apiClient else { return }
                    await store.refresh(using: client)
                }
            } label: {
                Label("Refresh history", systemImage: "arrow.clockwise")
            }
        }
    }

    @ViewBuilder
    private func content(for history: BuyingHistory) -> some View {
        let wonGroupIds = Set(history.wonItems.compactMap(\.relistingGroupId))
        let filteredItems = history.lostItems.filter { item in
            switch filter {
            case .all:
                return true
            case .neverWon:
                return !(item.relistingGroupId.map(wonGroupIds.contains) ?? false)
            case .eventuallyWon:
                return item.relistingGroupId.map(wonGroupIds.contains) ?? false
            }
        }

        HStack(spacing: 16) {
            metric("Lost bids", String(history.counts.lost))
            metric("Never won", String(history.counts.neverWon))
            metric("Eventually won", String(history.counts.eventuallyWon))
        }

        Picker("Filter", selection: $filter) {
            ForEach(LostFilter.allCases) { option in
                Text(option.label).tag(option)
            }
        }
        .pickerStyle(.segmented)
        .labelsHidden()

        if filteredItems.isEmpty {
            ContentUnavailableView("No tracked auctions", systemImage: "gavel")
        } else {
            VStack(spacing: 0) {
                ForEach(filteredItems) { item in
                    HistoryItemRow(item: item, isEventuallyWon: item.relistingGroupId.map(wonGroupIds.contains) ?? false)
                    if item.id != filteredItems.last?.id {
                        Divider()
                    }
                }
            }
        }
    }

    private func metric(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(value).font(.title2.bold())
            Text(label).font(.caption).foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

private struct HistoryItemRow: View {
    let item: HistoryItem
    let isEventuallyWon: Bool

    var body: some View {
        HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: 4) {
                Text(item.title).font(.headline)
                Text(subtitle).font(.caption).foregroundStyle(.secondary)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 4) {
                Text(item.maxBid.map { "max bid: \(formatMoney($0))" } ?? "max bid unavailable")
                    .font(.caption)
                Text(item.currentPrice.map { "sold for: \(formatMoney($0))" } ?? "sold price unavailable")
                    .font(.caption)
                Text(isEventuallyWon ? "Eventually won" : "Still unresolved")
                    .font(.caption.bold())
                    .foregroundStyle(isEventuallyWon ? .orange : .secondary)
            }
        }
        .padding(.vertical, 10)
    }

    private var subtitle: String {
        var parts = [item.sellerUserId?.trimmingCharacters(in: .whitespaces).nilIfEmpty ?? "Unknown seller"]
        if let condition = item.conditionDisplayName { parts.append(condition) }
        if let endTime = item.endTime, let date = ISO8601DateFormatter().date(from: endTime) {
            parts.append("ended \(date.formatted(date: .abbreviated, time: .omitted))")
        }
        return parts.joined(separator: " | ")
    }

    private func formatMoney(_ money: Money) -> String {
        money.value.formatted(.currency(code: money.currency))
    }
}

private extension String {
    var nilIfEmpty: String? { isEmpty ? nil : self }
}

#Preview {
    WatchlistView()
        .environment(AppSettings())
        .environment(BuyingHistoryStore())
}
