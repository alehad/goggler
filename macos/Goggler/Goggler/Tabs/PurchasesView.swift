import SwiftUI

/// Native port of the web app's "Won item history" tab (`Won` in app/page.tsx),
/// scoped to the list core for this phase — the price-over-time chart, the
/// matched-sales "paid vs. average" comparison badge, and the cross-link into
/// Analytics are deferred (see macos-purchases-tab/proposal.md).
struct PurchasesView: View {
    @Environment(AppSettings.self) private var appSettings
    @Environment(BuyingHistoryStore.self) private var store
    @State private var searchQuery = ""

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
                        description: Text("Connect eBay to view purchases.")
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
                Text("Purchases")
                    .font(.largeTitle.bold())
                Text("Won item history")
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
        let term = searchQuery.trimmingCharacters(in: .whitespaces).lowercased()
        let filteredItems = term.isEmpty
            ? history.wonItems
            : history.wonItems.filter { item in
                item.title.lowercased().contains(term) || (item.sellerUserId?.lowercased().contains(term) ?? false)
            }

        HStack {
            TextField("Search by title or seller", text: $searchQuery)
                .textFieldStyle(.roundedBorder)
            Spacer()
            Text("\(filteredItems.count) purchase\(filteredItems.count == 1 ? "" : "s")")
                .font(.caption)
                .foregroundStyle(.secondary)
        }

        if filteredItems.isEmpty {
            ContentUnavailableView(
                term.isEmpty ? "No purchases yet" : "No matches",
                systemImage: "shippingbox",
                description: Text(
                    term.isEmpty
                        ? "Won items will appear here after eBay reports them in your buying history."
                        : "No purchases match your search."
                )
            )
        } else {
            VStack(spacing: 0) {
                ForEach(filteredItems) { item in
                    PurchaseRow(item: item)
                    if item.id != filteredItems.last?.id {
                        Divider()
                    }
                }
            }
        }
    }
}

private struct PurchaseRow: View {
    let item: HistoryItem

    var body: some View {
        HStack(alignment: .top) {
            RecordThumbnail(imageUrl: item.imageUrl, placeholderSystemImage: "shippingbox")
            VStack(alignment: .leading, spacing: 4) {
                Text(item.title).font(.headline)
                Text(subtitle).font(.caption).foregroundStyle(.secondary)
            }
            Spacer()
            Text(item.currentPrice.map { "paid: \(formatMoney($0))" } ?? "price unavailable")
                .font(.caption)
        }
        .padding(.vertical, 10)
    }

    private var subtitle: String {
        var parts = [item.sellerUserId?.trimmingCharacters(in: .whitespaces).nilIfEmpty ?? "Unknown seller"]
        if let endTime = item.endTime, let date = ISO8601DateFormatter().date(from: endTime) {
            parts.append("won \(date.formatted(date: .abbreviated, time: .omitted))")
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
    PurchasesView()
        .environment(AppSettings())
        .environment(BuyingHistoryStore())
}
