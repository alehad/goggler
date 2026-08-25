import Foundation

/// The four main tabs, matching the web app's bottom tab bar
/// (app/page.tsx's Tab type: dashboard/tracking/won/analytics) minus the
/// "account" tab, which this app treats as Settings — reachable but
/// visually separate, pinned at the bottom of the sidebar rather than
/// mixed into this list.
enum SidebarItem: String, CaseIterable, Identifiable {
    case home
    case watchlist
    case purchases
    case analytics

    var id: Self { self }

    var label: String {
        switch self {
        case .home: return "Home"
        case .watchlist: return "Watchlist"
        case .purchases: return "Purchases"
        case .analytics: return "Analytics"
        }
    }

    var systemImage: String {
        switch self {
        case .home: return "house"
        case .watchlist: return "heart"
        case .purchases: return "bag"
        case .analytics: return "chart.line.uptrend.xyaxis"
        }
    }
}
