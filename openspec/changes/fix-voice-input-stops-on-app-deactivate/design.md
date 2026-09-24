# Design: Stop voice input when the app is deactivated

## Consolidated stop helper

```swift
private func stopVoiceInput() {
    voiceTask?.cancel()
    voiceService.stop()
    voiceListening = false
}
```

Replaces the identical three-line sequence currently duplicated in `.onDisappear` and `toggleVoiceInput()`'s stop branch.

## App-deactivation observation

**First attempt (didn't work, confirmed live):** `@Environment(\.scenePhase)` + `.onChange(of: scenePhase)`, expecting the phase to move to `.inactive` on losing focus. On macOS, `scenePhase` tracks *window visibility within this app*, not whether `NSApplication` itself is still frontmost — Cmd+Tab-ing to another app leaves this window fully visible (still `.active`) even though the app has lost focus. The mic stayed on in the menu bar after tabbing away.

**Actual fix:** AppKit's own notification for exactly this:

```swift
.onReceive(NotificationCenter.default.publisher(for: NSApplication.didResignActiveNotification)) { _ in
    stopVoiceInput()
}
```

Added alongside the existing `.onDisappear` on the root `ScrollView`. `NSApplication.didResignActiveNotification` fires exactly when the app loses focus to another app (Cmd+Tab away, clicking another app), independent of scene/window state — the signal actually needed here. `.onDisappear` still separately handles the tab-switch case (the view itself leaving the hierarchy), since neither of these fires when the user only switches tabs within the still-frontmost app.

Calling `stopVoiceInput()` when not already listening (e.g. the phase flickers, or fires once at initial mount) is safe and cheap: `voiceTask?.cancel()` on a `nil` task is a no-op, `voiceService.stop()` already guards on `isListening`, and resetting `voiceListening = false` when it's already `false` is inert.

## Testing

No new automated coverage — `scenePhase` transitions aren't something this repo's test target can drive (no UI/scene test harness), consistent with the rest of this feature's manual-only verification. Manual functional testing pause: start voice input, Cmd+Tab to another app, confirm listening stops (no further transcript updates, mic button reflects "not listening" on returning to the app).
