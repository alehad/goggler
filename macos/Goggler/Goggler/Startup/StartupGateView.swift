import SwiftUI
import AppKit

/// Tailscale ships a couple of different bundle IDs depending on install
/// method (system-extension vs. plain app), so look each up rather than
/// assuming one — falling back to the conventional /Applications path.
private let tailscaleBundleIdentifiers = ["io.tailscale.ipn.macsys", "io.tailscale.ipn.macos"]

/// Wraps the sidebar/detail UI and blocks it behind a connectivity check on
/// launch, so a down Tailscale connection shows a clear message with a way
/// forward instead of a silent hang or a bare per-tab error. Derives its
/// state entirely from `BuyingHistoryStore` rather than a separate state
/// machine — see macos-watchlist-and-startup-check/design.md.
struct StartupGateView<Content: View>: View {
    @Environment(AppSettings.self) private var appSettings
    @Environment(BuyingHistoryStore.self) private var store
    @State private var isSettingsPresented = false

    @ViewBuilder var content: () -> Content

    var body: some View {
        ZStack {
            content()
                .disabled(!store.isBackendConfirmedReachable)
                .blur(radius: store.isBackendConfirmedReachable ? 0 : 6)

            if !store.isBackendConfirmedReachable {
                overlay
            }
        }
        .task {
            await runCheck()
        }
        .sheet(isPresented: $isSettingsPresented) {
            SettingsView()
        }
    }

    private var overlay: some View {
        VStack(spacing: 16) {
            if store.connectionLoadFailed {
                Image(systemName: store.connectivityIssue == .backendUnreachable ? "server.rack" : "wifi.slash")
                    .font(.largeTitle)
                    .foregroundStyle(.red)
                Text(failureTitle)
                    .font(.title2.bold())
                Text(failureMessage)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                HStack(spacing: 12) {
                    Button("Retry") {
                        AppLog.startup.debug("Retry tapped")
                        Task { await runCheck() }
                    }
                    .buttonStyle(.borderedProminent)
                    if store.connectivityIssue != .backendUnreachable {
                        Button("Open Tailscale") {
                            openTailscale()
                        }
                    }
                    Button("Open Settings") {
                        AppLog.startup.debug("Open Settings tapped")
                        isSettingsPresented = true
                    }
                }
            } else {
                ProgressView()
                Text("Checking connection…")
                    .foregroundStyle(.secondary)
            }
        }
        .padding(32)
        .frame(maxWidth: 380)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 16))
        .shadow(radius: 20)
    }

    private var failureTitle: String {
        store.connectivityIssue == .backendUnreachable ? "goggler isn't responding" : "Can't reach goggler"
    }

    private var failureMessage: String {
        switch store.connectivityIssue {
        case .backendUnreachable:
            return "Tailscale is connected, but nothing answered at this address. Make sure the goggler backend is running, then try again."
        case .tunnelUnreachable, nil:
            return "Check that Tailscale is running and connected, then try again."
        }
    }

    private func runCheck() async {
        guard let client = appSettings.apiClient else {
            AppLog.startup.error("runCheck: appSettings.apiClient is nil (invalid base URL: \(appSettings.baseURLString, privacy: .public))")
            return
        }
        AppLog.startup.debug("runCheck: starting against \(client.baseURL.absoluteString, privacy: .public)")
        await store.refresh(using: client)
        AppLog.startup.debug("runCheck: done, isBackendConfirmedReachable=\(store.isBackendConfirmedReachable, privacy: .public)")
    }

    private func openTailscale() {
        for bundleIdentifier in tailscaleBundleIdentifiers {
            if let url = NSWorkspace.shared.urlForApplication(withBundleIdentifier: bundleIdentifier) {
                AppLog.startup.debug("Open Tailscale: resolved \(bundleIdentifier, privacy: .public) -> \(url.path, privacy: .public)")
                NSWorkspace.shared.open(url)
                return
            }
        }
        AppLog.startup.debug("Open Tailscale: no known bundle id resolved, falling back to /Applications/Tailscale.app")
        NSWorkspace.shared.open(URL(fileURLWithPath: "/Applications/Tailscale.app"))
    }
}
