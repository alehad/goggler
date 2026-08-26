import os

/// Centralizes the app's Logger instances so log lines show up in
/// Console.app (filter by process "Goggler") even when the app was launched
/// via Finder/`open` rather than from Xcode.
enum AppLog {
    static let startup = Logger(subsystem: "com.goggler.Goggler", category: "startup")
    static let network = Logger(subsystem: "com.goggler.Goggler", category: "network")
}
