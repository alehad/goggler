import SwiftUI

/// Mirrors the web app's "My" tab in spirit (the one place account/config
/// settings live), presented as a sheet rather than a sidebar selection —
/// see design.md for why. Phase 1 only needs the backend URL; account
/// info and eBay connect/disconnect land once OAuth exists.
///
/// Matching preferences are the app's first genuinely shared, server-persisted
/// setting (see server-side-matching-preferences/design.md) — loaded via GET
/// on appear, saved via an explicit Save button, same interaction shape as
/// the web app's own Account tab so both clients present the same model.
struct SettingsView: View {
    @Environment(AppSettings.self) private var appSettings
    @Environment(\.dismiss) private var dismiss
    @State private var savedPreferences: MatchingPreferences?
    @State private var draft: MatchingPreferences?
    @State private var saving = false
    @State private var statusMessage: String?

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

            Section("Matching preferences") {
                if let draft {
                    Toggle(
                        "Exact title match",
                        isOn: Binding(
                            get: { draft.exactTitleMatch },
                            set: { self.draft?.exactTitleMatch = $0 }
                        )
                    )
                    TextField(
                        "Criteria",
                        text: Binding(
                            get: { draft.criteriaText },
                            set: { self.draft?.criteriaText = $0 }
                        ),
                        axis: .vertical
                    )
                    .lineLimit(3...6)

                    HStack {
                        Button("Save") { Task { await save() } }
                            .disabled(saving || draft == savedPreferences)
                        if saving {
                            ProgressView().controlSize(.small)
                        }
                    }

                    if let statusMessage {
                        Text(statusMessage).font(.caption).foregroundStyle(.secondary)
                    }
                } else {
                    ProgressView()
                }
            }
        }
        .formStyle(.grouped)
        .frame(width: 420, height: 420)
        .toolbar {
            ToolbarItem(placement: .confirmationAction) {
                Button("Done") { dismiss() }
            }
        }
        .task {
            guard let client = appSettings.apiClient else { return }
            if let (preferences, _) = try? await client.requestDecoded("/api/matching-preferences", as: MatchingPreferences.self) {
                savedPreferences = preferences
                draft = preferences
            } else {
                statusMessage = "Could not load matching preferences"
            }
        }
    }

    private func save() async {
        guard let draft, let client = appSettings.apiClient else { return }
        saving = true
        statusMessage = nil
        defer { saving = false }

        do {
            let (saved, statusCode) = try await client.requestDecoded(
                "/api/matching-preferences",
                as: MatchingPreferences.self,
                method: "PUT",
                jsonBody: ["exactTitleMatch": draft.exactTitleMatch, "criteriaText": draft.criteriaText]
            )
            guard (200..<300).contains(statusCode) else {
                statusMessage = "Could not save matching preferences"
                return
            }
            savedPreferences = saved
            self.draft = saved
            statusMessage = "Matching preferences saved"
        } catch {
            statusMessage = "Could not save matching preferences"
        }
    }
}

#Preview {
    SettingsView()
        .environment(AppSettings())
}
