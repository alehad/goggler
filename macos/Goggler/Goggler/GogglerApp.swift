import SwiftUI

@main
struct GogglerApp: App {
    @State private var appSettings = AppSettings()
    @State private var buyingHistoryStore = BuyingHistoryStore()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environment(appSettings)
                .environment(buyingHistoryStore)
                .frame(minWidth: 800, minHeight: 500)
        }
    }
}
