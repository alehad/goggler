# Proposal: macOS Analytics AI assistant voice input

## Why

The web app's AI assistant question field has a mic button (browser Speech Recognition API) so the user can speak a question instead of typing it. The macOS Analytics tab just shipped the text-chat half of this feature ([[macos-analytics-ai-assistant]]) but deliberately deferred voice input, since the web implementation has no macOS equivalent to port — it needs Apple's `Speech` framework plus new microphone/speech-recognition permissions, a genuinely separate piece of work.

## What Changes

- A mic button appears next to the question field (only when speech recognition is actually available on this Mac — matching the web app's own `voiceSupported` gate, which only shows its mic button when the browser supports it).
- Tapping it starts listening: `SFSpeechRecognizer` (`en-GB`, matching the web app's locale) + `AVAudioEngine` for capture, with the recognized text updating the question field live as the user speaks — matching the web app's interim-results behavior exactly. Tapping again, or a natural pause in speech, stops listening. No auto-submit: the user still taps "Ask", same as web.
- New `VoiceInputService` (mirroring the existing `EbayAuthService` pattern — a dedicated `@MainActor` service class the view calls into, not logic inlined in the view) owns the `SFSpeechRecognizer`/`AVAudioEngine` lifecycle and authorization request.
- New Info.plist usage-description keys (`NSMicrophoneUsageDescription`, `NSSpeechRecognitionUsageDescription`) and a new sandbox entitlement (`com.apple.security.device.audio-input`) — the app is sandboxed today with no audio capture entitlement at all.
- Error handling matches web's three cases: permission denied, no speech detected, and a generic failure — same three user-facing messages web already shows.

## Out of Scope

- Any change to the text-chat flow itself ([[macos-analytics-ai-assistant]]) — voice only ever populates the question field; submission is unchanged.
- Continuous/hands-free listening, wake words, or any UX beyond the web app's existing tap-to-toggle-then-manually-submit shape.
- iOS — this targets the macOS app only, matching every other change in this codebase's macOS track so far.

## Success Criteria

- On a Mac where speech recognition is available, tapping the mic button and speaking populates the question field with the recognized text live, matching the web app's behavior.
- On first use, the OS permission prompts for microphone and speech recognition appear (via the new Info.plist descriptions), and a clear denial is handled the same way the web app handles browser permission denial (a visible error, not a silent failure or a crash).
- The mic button doesn't appear at all when speech recognition isn't available on the current Mac, matching `voiceSupported`'s web behavior.
