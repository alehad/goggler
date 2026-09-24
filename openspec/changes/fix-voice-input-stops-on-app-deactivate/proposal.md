# Change: Stop voice input when the app is deactivated, not just on tab-switch

## Why

[[macos-analytics-voice-input]] fixed voice capture continuing after the stop UI disappeared for two paths — switching tabs and tapping the mic button a second time — but explicitly deferred a third: backgrounding the whole app (Cmd+Tab away) while listening. That was a deliberate, signed-off scope decision at the time (short voice queries already auto-stop on a pause in speech regardless), but the user has since asked to close it too, so every angle the review raised is actually handled rather than left as an accepted gap.

## What Changes

- `AnalyticsView` observes `@Environment(\.scenePhase)` and stops voice input (cancelling any in-flight start `Task`, calling `voiceService.stop()`, resetting `voiceListening`) whenever the scene leaves `.active` — covering the app losing focus, not just this view disappearing.
- The three call sites that need this same three-step stop sequence (`.onDisappear`, the manual toggle-off branch, and this new scene-phase observer) are consolidated into one private helper, rather than tripling the same three lines.

## Out of Scope

- Anything else about the voice-input feature — this is purely closing the one previously-deferred gap.

## Success Criteria

- Starting voice input, then switching away from the app entirely (Cmd+Tab, clicking another app), stops capture — matching the behavior tab-switch and manual toggle-off already have.
