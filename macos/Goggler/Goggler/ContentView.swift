import SwiftUI

/// Sidebar/detail shell: the four main tabs at the top of the sidebar,
/// Settings pinned at the bottom and visually separate — the same shape
/// Claude Code's desktop app uses, and distinct from how the web app
/// treats its "My" tab as a fifth equal tab (native conventions differ
/// from the web tab bar this mirrors otherwise).
struct ContentView: View {
    @State private var selection: SidebarItem? = .home
    @State private var isSettingsPresented = false

    var body: some View {
        NavigationSplitView {
            VStack(spacing: 0) {
                List(SidebarItem.allCases, selection: $selection) { item in
                    Label(item.label, systemImage: item.systemImage)
                }
                .listStyle(.sidebar)

                Divider()

                Button {
                    isSettingsPresented = true
                } label: {
                    Label("Settings", systemImage: "gearshape")
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                .buttonStyle(.plain)
                .padding(12)
            }
            .navigationSplitViewColumnWidth(min: 180, ideal: 220)
        } detail: {
            detailView
        }
        .sheet(isPresented: $isSettingsPresented) {
            SettingsView()
        }
    }

    @ViewBuilder
    private var detailView: some View {
        switch selection {
        case .home:
            HomeView()
        case .watchlist:
            PlaceholderTabView(item: .watchlist)
        case .purchases:
            PlaceholderTabView(item: .purchases)
        case .analytics:
            PlaceholderTabView(item: .analytics)
        case nil:
            ContentUnavailableView("Select a tab", systemImage: "sidebar.left")
        }
    }
}

#Preview {
    ContentView()
        .environment(AppSettings())
}
