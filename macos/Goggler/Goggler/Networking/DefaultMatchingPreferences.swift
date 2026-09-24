import Foundation

/// The matching-preferences request-body fields every backend call that
/// needs them sends — shared by `BuyingHistoryStore`'s buying-history fetch
/// and `AnalyticsView`'s AI assistant, so the two can't silently drift.
/// macOS has no matching-preferences settings screen yet (unlike the web
/// app), so this is a fixed default rather than something the user can
/// change.
enum DefaultMatchingPreferences {
    static let requestBody: [String: Sendable] = [
        "exactTitleMatch": true,
        "criteriaText": #"\b[A-Z]{1,5}-?\d{1,6}\b"#
    ]
}
