# Tasks: Stop voice input when the app is deactivated

- [x] Create OpenSpec change documenting the fix.
- [x] Wait for user sign-off before implementing (informal — this was requested directly, closing a gap already discussed and deferred with the user's own explicit prior sign-off).
- [x] Consolidate `.onDisappear` and `toggleVoiceInput()`'s duplicated stop sequence into a private `stopVoiceInput()` helper.
- [x] Add `@Environment(\.scenePhase)` and an `.onChange(of: scenePhase)` handler calling `stopVoiceInput()` when the phase leaves `.active`.
- [x] `xcodegen generate`, `xcodebuild build`, `xcodebuild test` — 35/35 clean.
- [x] Manual functional testing pause. **First attempt didn't work**: `@Environment(\.scenePhase)` doesn't track app-level focus on macOS — it reflects window visibility within this app, not whether `NSApplication` itself is still frontmost. Cmd+Tab-ing away left the window fully visible (still `.active`), so the mic stayed on in the menu bar — confirmed live by the user. Switched to AppKit's own `NSApplication.didResignActiveNotification` via `.onReceive(NotificationCenter.default.publisher(for:))`, which fires exactly on losing focus to another app, independent of scene/window state. Rebuilt, retested — user confirmed "it works, mic stops when I tab away".
- [x] Run dual security review (security-review skill + Copilot CLI) — both clean, no findings.
- [x] Ship via PR.
