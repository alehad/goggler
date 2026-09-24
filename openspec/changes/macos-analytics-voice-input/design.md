# Design: macOS Analytics AI assistant voice input

## Permissions

`macos/Goggler/Goggler/Goggler.entitlements` gains the audio-capture entitlement the sandboxed app needs:

```xml
<key>com.apple.security.device.audio-input</key>
<true/>
```

`project.yml`'s `info.properties` (generated Info.plist) gains the two usage descriptions macOS requires before it will even show the permission prompts:

```yaml
NSMicrophoneUsageDescription: "goggler uses your microphone so you can ask the price-history assistant a question by voice instead of typing."
NSSpeechRecognitionUsageDescription: "goggler uses on-device (or Apple's) speech recognition to turn what you say into a question for the price-history assistant."
```

## `VoiceInputService`

New file, mirroring `EbayAuthService`'s established shape (a dedicated `@MainActor` service class the view calls into — not inlined logic — matching how this codebase already separates "one focused async capability" from the view that uses it):

```swift
import Foundation
import Speech

@MainActor
final class VoiceInputService: NSObject {
    enum ListenError: Equatable {
        case permissionDenied
        case noSpeech
        case other(String)

        var message: String {
            switch self {
            case .permissionDenied: return "Microphone access denied"
            case .noSpeech: return "Didn't catch that — try again"
            case .other: return "Voice input failed"
            }
        }
    }

    /// Matches the web app's `voiceSupported` gate — checked once, not live,
    /// same granularity as `getSpeechRecognitionConstructor` only checking
    /// whether the browser API exists at all, not real-time availability.
    static var isSupported: Bool {
        SFSpeechRecognizer(locale: Locale(identifier: "en-GB")) != nil
    }

    private let audioEngine = AVAudioEngine()
    private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
    private var recognitionTask: SFSpeechRecognitionTask?

    private(set) var isListening = false

    /// Starts listening, calling `onTranscript` with the growing recognized
    /// text as results arrive (interim + final, same as the web app's
    /// `recognition.onresult` accumulating `event.results`), until
    /// `stop()` is called or recognition ends on its own (a natural pause
    /// — `SFSpeechAudioBufferRecognitionRequest` behaves like the web
    /// app's `continuous = false`). Calls `onFinish` exactly once, with an
    /// error if the session ended abnormally.
    func start(onTranscript: @escaping (String) -> Void, onFinish: @escaping (ListenError?) -> Void) async {
        guard let recognizer = SFSpeechRecognizer(locale: Locale(identifier: "en-GB")), recognizer.isAvailable else {
            onFinish(.other("unavailable"))
            return
        }

        let authStatus = await requestAuthorization()
        guard authStatus == .authorized else {
            onFinish(.permissionDenied)
            return
        }

        let request = SFSpeechAudioBufferRecognitionRequest()
        request.shouldReportPartialResults = true
        if recognizer.supportsOnDeviceRecognition {
            request.requiresOnDeviceRecognition = true
        }
        recognitionRequest = request

        let inputNode = audioEngine.inputNode
        let format = inputNode.outputFormat(forBus: 0)
        inputNode.installTap(onBus: 0, bufferSize: 1024, format: format) { [weak self] buffer, _ in
            self?.recognitionRequest?.append(buffer)
        }

        do {
            audioEngine.prepare()
            try audioEngine.start()
        } catch {
            stop()
            onFinish(.other(String(describing: error)))
            return
        }

        isListening = true
        recognitionTask = recognizer.recognitionTask(with: request) { [weak self] result, error in
            Task { @MainActor in
                guard let self else { return }
                if let result {
                    onTranscript(result.bestTranscription.formattedString)
                    if result.isFinal {
                        self.stop()
                        onFinish(nil)
                    }
                    return
                }
                if let error {
                    let nsError = error as NSError
                    self.stop()
                    // SFSpeechRecognizer reports "no speech detected" via
                    // this domain/code, confirmed empirically — matches the
                    // web app's onerror branch for `event.error === "no-speech"`.
                    onFinish(nsError.domain == "kAFAssistantErrorDomain" && nsError.code == 1110 ? .noSpeech : .other(nsError.localizedDescription))
                }
            }
        }
    }

    func stop() {
        guard isListening else { return }
        isListening = false
        audioEngine.stop()
        audioEngine.inputNode.removeTap(onBus: 0)
        recognitionRequest?.endAudio()
        recognitionRequest = nil
        recognitionTask = nil
    }

    private func requestAuthorization() async -> SFSpeechRecognizerAuthorizationStatus {
        await withCheckedContinuation { continuation in
            SFSpeechRecognizer.requestAuthorization { status in
                continuation.resume(returning: status)
            }
        }
    }
}
```

Two things confirmed against this codebase's existing, hard-won precedent rather than assumed:

- `SFSpeechRecognizer.requestAuthorization`'s completion handler and `recognitionTask`'s result handler both fire off the main thread — the exact same class of issue already hit (and fixed) twice this session (`EbayAuthService`'s `ASWebAuthenticationSession` completion, `computeAnalyticsItems`). `requestAuthorization` is wrapped in `withCheckedContinuation` (matching `EbayAuthService.connect`'s own pattern for a callback-based system API); the recognition task's result closure is explicitly hopped back via `Task { @MainActor in }` before touching any `@MainActor`-isolated state or calling the view's callbacks.
- The exact `kAFAssistantErrorDomain`/code `1110` "no speech detected" identification needs confirming empirically against a real device during implementation (Apple doesn't document this error shape formally) — flagged here as a design intent, not a verified fact, the same way `ConnectivityIssue`'s two failure shapes in `BuyingHistoryStore` were only pinned down by testing against the real backend. If it doesn't match in practice, this specific branch degrades gracefully to `.other` (a slightly less precise message, "Voice input failed" instead of "Didn't catch that — try again"), not a crash or a silent failure.

## `AnalyticsView` changes

```swift
@State private var voiceService = VoiceInputService()
@State private var voiceListening = false
```

Mic button inserted between the question `TextField` and the "Ask" button, shown only when `VoiceInputService.isSupported`:

```swift
if VoiceInputService.isSupported {
    Button {
        if voiceListening {
            voiceService.stop()
            voiceListening = false
        } else {
            voiceListening = true
            Task {
                await voiceService.start(
                    onTranscript: { text in aiQuestion = text },
                    onFinish: { error in
                        voiceListening = false
                        if let error { aiError = error.message }
                    }
                )
            }
        }
    } label: {
        Image(systemName: voiceListening ? "mic.slash" : "mic")
    }
    .accessibilityLabel(voiceListening ? "Stop listening" : "Ask by voice")
}
```

`aiError` is the same error-text `@State` the text-chat flow already uses, so a voice failure surfaces exactly where a chat failure would — no new UI surface needed for errors.

## Testing

- `VoiceInputService.isSupported`: no meaningful unit test (it's a thin wrapper around whether `SFSpeechRecognizer` can be constructed for a fixed locale — always true in CI/Simulator-less macOS test runs, so this is a manual/real-device concern, not something to assert in `GogglerTests`).
- No automated coverage for the actual listen/transcribe/stop lifecycle — this needs a real microphone and real speech, the same category as `EbayAuthService`'s live OAuth exchange, which this codebase already treats as manual-only (verified against Production eBay, not unit-tested). Consistent precedent, not a gap being introduced.
- Manual functional testing pause: grant microphone + speech recognition permissions on first use, confirm the question field fills in live while speaking, confirm tapping the mic again (and a natural pause) both stop listening, confirm denying permission shows "Microphone access denied", confirm the mic button is absent if run on a Mac/account where speech recognition genuinely isn't available (hard to force deliberately — note if this can't be tested directly, and rely on the `isAvailable`/optional-init checks being correct by inspection instead).
