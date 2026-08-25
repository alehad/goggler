import SwiftUI

@main
struct GogglerApp: App {
    @State private var appSettings = AppSettings()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environment(appSettings)
                .frame(minWidth: 800, minHeight: 500)
        }
    }
}
