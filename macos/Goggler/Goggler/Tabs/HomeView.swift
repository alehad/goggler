import SwiftUI

/// The one tab in this phase that makes a real call end-to-end: on
/// appearance it calls config-status, session, and buying-history against
/// the real backend and renders whatever comes back — deliberately
/// including a real 409 (eBay not connected) rather than faking a happy
/// path, since eBay OAuth is a later phase. See design.md's "Why the Home
/// tab's first call is buying-history, not something friendlier."
struct HomeView: View {
    @Environment(AppSettings.self) private var appSettings

    enum BuyingHistoryState {
        case loading
        case reauthRequired
        case unavailable(message: String)
        case ready
    }

    @State private var configStatus: EbayConfigStatus.Config?
    @State private var connection: EbaySession.Connection?
    @State private var buyingHistoryState: BuyingHistoryState = .loading
    @State private var connectionLoadFailed = false

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
        .task {
            await load()
        }
    }

    private var connectionSection: some View {
        GroupBox("eBay Connection") {
            VStack(alignment: .leading, spacing: 6) {
                if connectionLoadFailed {
                    Label("Could not reach the server", systemImage: "wifi.slash")
                        .foregroundStyle(.red)
                } else if let connection {
                    Label(
                        connection.connected ? "Connected" : "Not connected",
                        systemImage: connection.connected ? "checkmark.circle.fill" : "xmark.circle"
                    )
                    .foregroundStyle(connection.connected ? .green : .secondary)
                    Text(connection.status)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                } else {
                    ProgressView()
                }

                if let configStatus, !configStatus.ready {
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
                switch buyingHistoryState {
                case .loading:
                    ProgressView()
                case .reauthRequired:
                    Label("Connect eBay to view buying history", systemImage: "link.circle")
                        .foregroundStyle(.secondary)
                case .unavailable(let message):
                    Label(message, systemImage: "exclamationmark.triangle")
                        .foregroundStyle(.red)
                case .ready:
                    Label("Buying history loaded", systemImage: "checkmark.circle.fill")
                        .foregroundStyle(.green)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private func load() async {
        guard let client = appSettings.apiClient else {
            connectionLoadFailed = true
            buyingHistoryState = .unavailable(message: "Invalid backend URL — check Settings.")
            return
        }

        await loadConnectionStatus(using: client)
        await loadBuyingHistory(using: client)
    }

    private func loadConnectionStatus(using client: GogglerAPIClient) async {
        do {
            let (status, _) = try await client.requestDecoded("/api/auth/ebay/config-status", as: EbayConfigStatus.self)
            configStatus = status.config
        } catch {
            connectionLoadFailed = true
        }

        do {
            let (session, _) = try await client.requestDecoded("/api/auth/ebay/session", as: EbaySession.self)
            connection = session.connection
        } catch {
            connectionLoadFailed = true
        }
    }

    private func loadBuyingHistory(using client: GogglerAPIClient) async {
        do {
            let raw = try await client.request(
                "/api/ebay/buying-history",
                method: "POST",
                jsonBody: ["exactTitleMatch": true, "criteriaText": #"\b[A-Z]{1,5}-?\d{1,6}\b"#]
            )

            switch raw.statusCode {
            case 200..<300:
                buyingHistoryState = .ready
            case 409:
                buyingHistoryState = .reauthRequired
            default:
                let message = GogglerAPIClient.errorMessage(from: raw.data) ?? "History is unavailable"
                buyingHistoryState = .unavailable(message: message)
            }
        } catch {
            buyingHistoryState = .unavailable(message: error.localizedDescription)
        }
    }
}

#Preview {
    HomeView()
        .environment(AppSettings())
}
