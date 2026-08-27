import SwiftUI

/// Renders `BuyingHistoryStore`'s state — deliberately including a real 409
/// (eBay not connected) rather than faking a happy path, since eBay OAuth is
/// a later phase. See design.md's "Why the Home tab's first call is
/// buying-history, not something friendlier." The initial load is triggered
/// once by `StartupGateView`, not here — this view only renders the shared
/// store's state, so Home and Watchlist never race to fetch independently.
struct HomeView: View {
    @Environment(AppSettings.self) private var appSettings
    @Environment(BuyingHistoryStore.self) private var store
    @State private var ebayAuthService = EbayAuthService()
    @State private var isConnectingEbay = false
    @State private var connectEbayErrorMessage: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                Text("Home")
                    .font(.largeTitle.bold())

                connectionSection
                buyingHistorySection

                Spacer()
            }
            .padding(24)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .alert("Couldn't connect eBay", isPresented: connectEbayErrorBinding) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(connectEbayErrorMessage ?? "")
        }
    }

    private var connectEbayErrorBinding: Binding<Bool> {
        Binding(
            get: { connectEbayErrorMessage != nil },
            set: { isPresented in if !isPresented { connectEbayErrorMessage = nil } }
        )
    }

    private var connectionSection: some View {
        GroupBox("eBay Connection") {
            VStack(alignment: .leading, spacing: 8) {
                if store.connectionLoadFailed {
                    Label("Could not reach the server", systemImage: "wifi.slash")
                        .foregroundStyle(.red)
                } else if let connection = store.connection {
                    Label(
                        connection.connected ? "Connected" : "Not connected",
                        systemImage: connection.connected ? "checkmark.circle.fill" : "xmark.circle"
                    )
                    .foregroundStyle(connection.connected ? .green : .secondary)
                    Text(connection.status)
                        .font(.caption)
                        .foregroundStyle(.secondary)

                    if !connection.connected {
                        Button {
                            connectEbay()
                        } label: {
                            if isConnectingEbay {
                                ProgressView().controlSize(.small)
                            } else {
                                Text("Connect eBay")
                            }
                        }
                        .disabled(isConnectingEbay)
                    }
                } else {
                    ProgressView()
                }

                if let configStatus = store.configStatus, !configStatus.ready {
                    Text("Server config incomplete: missing \(configStatus.missing.joined(separator: ", "))")
                        .font(.caption)
                        .foregroundStyle(.orange)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private var buyingHistorySection: some View {
        GroupBox("Buying History") {
            Group {
                switch store.buyingHistoryState {
                case .idle, .loading:
                    ProgressView()
                case .reauthRequired:
                    Label("Connect eBay to view buying history", systemImage: "link.circle")
                        .foregroundStyle(.secondary)
                case .unavailable(let message):
                    Label(message, systemImage: "exclamationmark.triangle")
                        .foregroundStyle(.red)
                case .ready(let history):
                    Label(
                        "\(history.counts.lost) tracked, \(history.counts.won) won",
                        systemImage: "checkmark.circle.fill"
                    )
                    .foregroundStyle(.green)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private func connectEbay() {
        isConnectingEbay = true
        Task {
            defer { isConnectingEbay = false }

            let result = await ebayAuthService.connect(appSettings: appSettings)
            AppLog.startup.debug("HomeView: connectEbay result=\(String(describing: result), privacy: .public)")
            switch result {
            case .connected:
                if let client = appSettings.apiClient {
                    await store.refresh(using: client)
                    AppLog.startup.debug("HomeView: post-connect refresh, connection.connected=\(store.connection?.connected ?? false, privacy: .public)")
                }
            case .cancelled:
                break
            case .failed(let message):
                connectEbayErrorMessage = message
            }
        }
    }
}

#Preview {
    HomeView()
        .environment(AppSettings())
        .environment(BuyingHistoryStore())
}
