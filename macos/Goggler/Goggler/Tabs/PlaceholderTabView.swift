import SwiftUI

/// Watchlist, Purchases, and Analytics aren't built yet — each becomes its
/// own phase once the shell and the real network pipeline (proven by
/// HomeView) are working. This exists so the sidebar is fully navigable
/// now rather than only partially wired up.
struct PlaceholderTabView: View {
    let item: SidebarItem

    var body: some View {
        ContentUnavailableView(
            item.label,
            systemImage: item.systemImage,
            description: Text("\(item.label) isn't built yet — this is a placeholder for a later phase.")
        )
    }
}

#Preview {
    PlaceholderTabView(item: .watchlist)
}
