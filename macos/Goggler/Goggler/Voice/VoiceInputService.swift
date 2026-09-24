import Foundation
@preconcurrency import Speech

/// Drives voice input for the Analytics AI assistant's question field via
/// `SFSpeechRecognizer` + `AVAudioEngine` — the native equivalent of the web
/// app's browser Speech Recognition API. Populates the question field live
/// as speech is recognized; never submits automatically, matching the web
/// app's own tap-to-toggle-then-manually-submit shape exactly.
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

    /// Matches the web app's `voiceSupported` gate — a one-time check of
    /// whether the platform API exists at all, not a live availability
    /// probe (mirrors `getSpeechRecognitionConstructor` only checking for
    /// the browser API's existence).
    static var isSupported: Bool {
        SFSpeechRecognizer(locale: Locale(identifier: "en-GB")) != nil
    }

    private let audioEngine = AVAudioEngine()
    private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
    private var recognitionTask: SFSpeechRecognitionTask?
    private(set) var isListening = false

    /// Held as stored properties rather than captured directly by the
    /// `@Sendable` recognition-task closure below — mirroring
    /// `EbayAuthService`'s `session` property. A `@Sendable` closure can
    /// only capture `Sendable` values; these caller-supplied callbacks
    /// aren't `Sendable` (they close over `AnalyticsView`'s `@State`), so
    /// the outer closure instead captures only `[weak self]` (itself
    /// `Sendable`-safe) and reaches these properties from inside the
    /// nested `Task { @MainActor in }`, once actually back on the actor.
    private var onTranscript: ((String) -> Void)?
    private var onFinish: ((ListenError?) -> Void)?

    /// Starts listening, calling `onTranscript` with the growing recognized
    /// text as results arrive (interim + final — matching the web app's
    /// `recognition.onresult` accumulating `event.results`), until `stop()`
    /// is called or recognition ends on its own (a natural pause, the same
    /// shape as the web app's `continuous = false`). Calls `onFinish`
    /// exactly once, with an error if the session ended abnormally.
    func start(onTranscript: @escaping (String) -> Void, onFinish: @escaping (ListenError?) -> Void) async {
        self.onTranscript = onTranscript
        self.onFinish = onFinish

        guard let recognizer = SFSpeechRecognizer(locale: Locale(identifier: "en-GB")), recognizer.isAvailable else {
            AppLog.voice.error("start: recognizer unavailable")
            finish(.other("unavailable"))
            return
        }

        let authStatus = await requestAuthorization()
        AppLog.voice.debug("start: authStatus=\(String(describing: authStatus), privacy: .public)")
        guard authStatus == .authorized else {
            finish(.permissionDenied)
            return
        }

        // The caller may have cancelled the enclosing Task while this was
        // suspended awaiting authorization (e.g. the user switched away
        // from the Analytics tab) — checked here, before touching the
        // microphone at all, so a stale resume can't start capture with no
        // UI left able to stop it. Silently discards the callbacks rather
        // than calling `finish`: the view that supplied them is gone, so
        // there's nothing left to report to.
        guard !Task.isCancelled else {
            AppLog.voice.debug("start: cancelled before capture began")
            self.onTranscript = nil
            self.onFinish = nil
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
        // Captures `request` directly rather than going through
        // `self.recognitionRequest`, and is marked `@Sendable` — this
        // closure runs on the audio engine's real-time render thread,
        // never the main thread. Confirmed via a second real crash report
        // that avoiding `self`/MainActor state alone isn't enough: a
        // closure literal lexically nested inside a @MainActor method
        // (`start`) is inferred @MainActor-isolated regardless of what it
        // actually captures (the same lexical-inference behavior already
        // seen with `computeAnalyticsItems`, which had no `self` reference
        // either) — it crashes the instant the system invokes it off the
        // main thread. `@Sendable` breaks that inference. `request` is a
        // plain reference type Apple's own API is designed to have
        // `.append` called on from exactly this thread.
        inputNode.installTap(onBus: 0, bufferSize: 1024, format: format) { @Sendable buffer, _ in
            request.append(buffer)
        }
        // Set before `audioEngine.start()` is even attempted, not after it
        // succeeds — `stop()` below is a no-op while this is false (see its
        // `guard isListening else { return }`), so if `start()` throws, the
        // tap installed just above would otherwise never be removed. A
        // second `start()` call would then hit `installTap` on a bus that
        // already has one installed, which raises an uncatchable
        // `!hasTapOnBus` exception — one recoverable failure would
        // otherwise permanently break voice input for the rest of the app
        // session. `stop()` itself is safe to call on an engine that was
        // only `prepare()`d, never actually `start()`ed.
        isListening = true

        do {
            audioEngine.prepare()
            try audioEngine.start()
        } catch {
            AppLog.voice.error("start: audioEngine.start() failed — \(String(describing: error), privacy: .public)")
            stop()
            finish(.other(String(describing: error)))
            return
        }

        recognitionTask = recognizer.recognitionTask(with: request) { @Sendable [weak self] result, error in
            // This closure — like SFSpeechRecognizer.requestAuthorization's
            // completion handler below — is not guaranteed to run on the
            // main thread. A closure literal defined inside a @MainActor
            // type is otherwise erroneously inferred as @MainActor-isolated
            // (the same class of issue already hit and fixed twice in this
            // codebase: EbayAuthService's ASWebAuthenticationSession
            // completion, AnalyticsView's computeAnalyticsItems), which
            // crashes (EXC_BREAKPOINT / dispatch_assert_queue_fail) the
            // moment the system calls it from a non-main thread, confirmed
            // via an actual crash report on this exact pattern. `@Sendable`
            // here breaks that inference. `SFSpeechRecognitionResult`/
            // `Error` aren't `Sendable` either, so the plain values
            // actually needed are pulled out here, before crossing into
            // the Task, rather than sending `result`/`error` themselves.
            let transcript = result?.bestTranscription.formattedString
            let isFinal = result?.isFinal ?? false
            let nsError = error.map { $0 as NSError }

            Task { @MainActor in
                guard let self else { return }
                if let transcript {
                    self.onTranscript?(transcript)
                    if isFinal {
                        self.stop()
                        self.finish(nil)
                    }
                    return
                }
                if let nsError {
                    AppLog.voice.error("recognitionTask: domain=\(nsError.domain, privacy: .public) code=\(nsError.code, privacy: .public) — \(nsError.localizedDescription, privacy: .public)")
                    self.stop()
                    // SFSpeechRecognizer reports "no speech detected" via
                    // this domain/code, confirmed empirically against a
                    // real device (see macos-analytics-voice-input/design.md)
                    // — falls back to a generic message if this ever
                    // doesn't match rather than mis-attributing the error.
                    self.finish(nsError.domain == "kAFAssistantErrorDomain" && nsError.code == 1110 ? .noSpeech : .other(nsError.localizedDescription))
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

    private func finish(_ error: ListenError?) {
        let callback = onFinish
        onTranscript = nil
        onFinish = nil
        callback?(error)
    }

    /// `nonisolated` deliberately: this method touches no instance state
    /// (only a local `continuation`), so nothing here needs — or should
    /// have — @MainActor isolation inferred onto it. `SFSpeechRecognizer.
    /// requestAuthorization`'s completion handler runs on an arbitrary
    /// system (TCC/XPC) thread; without `nonisolated`, the closure below
    /// would be erroneously inferred as @MainActor-isolated (this class is
    /// @MainActor) and crash the moment it's actually invoked off the main
    /// thread — confirmed via a real crash report (EXC_BREAKPOINT /
    /// dispatch_assert_queue_fail / _swift_task_checkIsolatedSwift) pointing
    /// directly at this closure, the same class of issue already hit twice
    /// elsewhere in this codebase. `CheckedContinuation.resume` is safe to
    /// call from any thread, so no thread-hop is needed here at all — this
    /// is simpler than the @Sendable + `Task { @MainActor in }` pattern
    /// used elsewhere in this file, appropriate because this closure never
    /// touches @MainActor-isolated state.
    private nonisolated func requestAuthorization() async -> SFSpeechRecognizerAuthorizationStatus {
        await withCheckedContinuation { continuation in
            SFSpeechRecognizer.requestAuthorization { status in
                continuation.resume(returning: status)
            }
        }
    }
}
