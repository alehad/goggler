import SwiftUI

/// Mirrors the web app's "My" tab in spirit (the one place account/config
/// settings live), presented as a sheet rather than a sidebar selection —
/// see design.md for why. Phase 1 only needs the backend URL; account
/// info and eBay connect/disconnect land once OAuth exists.
struct SettingsView: View {
    @Environment(AppSettings.self) private var appSettings
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        @Bindable var appSettings = appSettings

        Form {
            Section("Backend") {
                TextField("Base URL", text: $appSettings.baseURLString)
                    .textFieldStyle(.roundedBorder)

                if appSettings.baseURL == nil {
                    Label("Not a valid URL", systemImage: "exclamationmark.triangle")
                        .foregroundStyle(.red)
                        .font(.caption)
                }

                HStack {
                    Button("Use Tailscale") {
                        appSettings.baseURLString = AppSettings.tailscaleBaseURLString
                    }
                    Button("Use Local Dev Server") {
                        appSettings.baseURLString = AppSettings.localBaseURLString
                    }
                }
            }
        }
        .formStyle(.grouped)
        .frame(width: 420, height: 220)
        .toolbar {
            ToolbarItem(placement: .confirmationAction) {
                Button("Done") { dismiss() }
            }
        }
    }
}

#Preview {
    SettingsView()
        .environment(AppSettings())
}
