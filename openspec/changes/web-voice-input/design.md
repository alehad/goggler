# Design: Voice input for the Analytics AI assistant (web)

## Feature detection

```ts
const SpeechRecognitionCtor =
  typeof window !== "undefined" ? (window.SpeechRecognition ?? window.webkitSpeechRecognition) : undefined;
```

Checked once (e.g. via `useMemo`/module-level constant). If undefined, the mic control is never rendered — no error message, no disabled/greyed-out button, nothing to notice. Firefox (no support as of this writing) and any other unsupported browser just sees the existing text-only chatbox, unchanged. This matches how the rest of the app already treats browser capability gaps (e.g. graceful fallback rather than a hard requirement).

## State and flow

New state alongside the existing `aiQuestion`/`aiAnswer`/`aiError`/`aiLoading` in the `Analytics` component:

```ts
const [voiceListening, setVoiceListening] = useState(false);
const [voiceError, setVoiceError] = useState("");
const recognitionRef = useRef<SpeechRecognition | null>(null);
```

Tapping the mic button:
1. If already listening, call `recognitionRef.current?.stop()` (manual early stop) and return.
2. Otherwise construct a new `SpeechRecognitionCtor()` instance, configure it, wire its events, call `.start()`, store it in `recognitionRef`, set `voiceListening = true`.

Configuration:
- `lang = "en-GB"` — matches the `en-GB` locale already used throughout this file's own string formatting (`toLocaleLowerCase("en-GB")` etc.) and the app's eBay UK focus.
- `continuous = false` — one question is one utterance; the browser's own silence detection ends recognition automatically. No need for open-ended dictation.
- `interimResults = true` — live partial transcript updates `aiQuestion` as the user speaks, so the input never looks frozen/unresponsive. The final result (`event.results[i].isFinal`) replaces it with the settled transcript.

Events:
- `onresult`: update `aiQuestion` with the latest (interim or final) transcript. **Never auto-submits** — this only ever writes into the same `aiQuestion` field the text input already binds to, so the existing `askAssistant` submit handler and its validation (non-empty, not already loading) apply unchanged. Voice is a second way to fill in the question, not a second way to submit it.
- `onerror`: set `voiceError` to a short, human message based on `event.error` (`"not-allowed"` → "Microphone access denied", `"no-speech"` → "Didn't catch that — try again", anything else → a generic "Voice input failed" fallback); clear `voiceListening`.
- `onend`: clear `voiceListening` (covers both natural end-of-speech and manual stop).

## Why populate-then-review, not auto-submit

Two reasons, both concrete rather than hypothetical for this app specifically:
1. **Cost**: every question is a real, metered Anthropic API call ([[analytics-ai-assistant]]'s whole cost-consciousness thread — Haiku was chosen specifically because "cost scales linearly with every question asked"). A misheard transcript firing immediately wastes a call on a question that was never actually asked.
2. **No correction path**: the assistant is deliberately stateless per question ([[analytics-ai-assistant]]'s design — no conversation memory). If a misrecognized question got auto-submitted and answered wrong, there's no way to say "no, I meant X" — the next message starts from zero context, which live testing already showed produces a dead-end (see the "yes" follow-up bug that shipped a fix for). Letting the user glance at the transcript before pressing "Ask" catches a bad transcription before it becomes a wasted, confusing round-trip.

This is a judgment call, not a hard constraint — worth revisiting once there's real usage to look at, same as several defaults in the original AI assistant design.

## UI

- A mic icon button (`lucide-react`'s `Mic`/`MicOff`) inside the existing `.ai-assistant-input-row`, between the text input and the "Ask" button.
- Idle: outline `Mic` icon, same visual weight as the existing "Ask" button (`secondary-button compact` styling).
- Listening: swap to a filled/highlighted state (e.g. a `.listening` class — red/accent background, subtle pulse) so it's obvious speech is being captured; `aria-label` changes from "Ask by voice" to "Stop listening".
- `voiceError`, when set, renders the same way `aiError` already does (`<p className="form-message">`) — reuses the existing pattern rather than inventing a new one.
- The mic button is disabled while `aiLoading` (a question is already being answered), same as the text input effectively is via the existing submit-button disable logic.

## What this change does NOT touch

- `src/market-insights/chat.ts`, `app/api/market-insights/chat/route.ts` — completely unchanged. The route already just accepts `{ question: string }`; it has no way to know or care whether that string was typed or spoken.
- No new npm dependency — `SpeechRecognition` is a browser-native Web API, not a package.
- No new TypeScript types needed beyond ambient `SpeechRecognition`/`webkitSpeechRecognition` declarations on `Window` (TypeScript's DOM lib doesn't ship these yet as of the version this repo pins — a small local `.d.ts` ambient declaration covers just the surface actually used: `start`, `stop`, `continuous`, `interimResults`, `lang`, `onresult`, `onerror`, `onend`, and the `SpeechRecognitionEvent`/`SpeechRecognitionErrorEvent` shapes).

## Testing

This is a browser-native, hardware-dependent (microphone) capability — it cannot be meaningfully unit-tested the way the rest of this codebase is tested (no real `SpeechRecognition` implementation exists in Node/jsdom, and a mock would only prove the mock works, not that real speech recognition integrates correctly).

- `npx tsc --noEmit` and `npm run build` verify the code compiles and the ambient types are correct.
- Manual verification in a real browser (Chrome/Edge/Safari, which implement `SpeechRecognition`) is required and cannot be automated or done through a sandboxed preview browser — real microphone hardware and (for Chrome's implementation) a working network path to its speech-recognition backend are both needed. This is the same category of constraint as eBay OAuth needing the user's own real credentials: something only the user can do.
- Automatable checks: confirm the mic control is absent when `SpeechRecognition`/`webkitSpeechRecognition` are undefined on `window` (simulates Firefox), and present when defined — this can be checked by reading the rendered page, no real microphone needed.
- Manual pass (user): ask a real question by voice on at least one supported desktop browser, confirm the transcript appears in the field without auto-submitting, edit it, submit, and confirm the answer matches what typing the same question would produce. Also confirm a denied microphone permission surfaces `voiceError` without breaking typed input.
