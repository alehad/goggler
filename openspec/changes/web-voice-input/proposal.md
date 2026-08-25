# Proposal: Voice input for the Analytics AI assistant (web)

## Why

The Analytics tab's AI assistant ([[analytics-ai-assistant]]) currently only accepts typed questions. When that feature was designed, voice input was deliberately scoped out but the shape of it was already agreed and written into the spec: speech-to-text must be a client-side, platform-native capability that hands plain text to the exact same question-submission path as typing — never audio sent to, or through, the language model.

This change builds that for the web app specifically, using the browser's own Web Speech API. It's a small, self-contained UI addition: no new backend route, no new dependency, no change to `answerAnalyticsQuestion` or the chat API at all. The existing `POST /api/market-insights/chat` endpoint already doesn't care whether the `question` string it receives was typed or spoken.

This is step one of two the user asked for this session — a native macOS app is the planned follow-up, and will need its own separate design (Apple's `SFSpeechRecognizer`, not the Web Speech API — different platform, different implementation, same principle).

## What Changes

- Add a microphone control to the Analytics tab's chatbox, next to the existing text input.
- Uses the browser's native `SpeechRecognition` API (`window.SpeechRecognition` / `window.webkitSpeechRecognition`) to transcribe speech to text entirely client-side.
- A finished transcript populates the existing question field — it does not auto-submit. The user reviews/edits it and presses "Ask" themselves, exactly as if they'd typed it.
- The mic control only renders when the browser supports `SpeechRecognition`. Typed input keeps working everywhere regardless.
- No backend changes. No new npm dependency (the Web Speech API is built into the browser).

## Out of Scope

- The macOS/iOS native apps and their voice input (separate future change, own OpenSpec proposal).
- Auto-submitting a transcribed question without user review (see design.md's reasoning; open to revisiting after use).
- Continuous/hands-free listening, wake words, or multi-turn voice conversation.
- Any change to the chat backend, the model, or the tools it calls — this change is UI-only.

## Success Criteria

- On a browser with Web Speech API support (Chrome, Edge, Safari), tapping the mic, speaking a question, and pressing "Ask" produces the same answer as typing that question would.
- On a browser without support (e.g. Firefox), the Analytics tab renders normally with no mic control and no error — typed input is unaffected.
- No audio ever leaves the browser through goggler's own code; only the browser's own speech-recognition engine ever sees it (the same mechanism as searching by voice in the browser's own address bar).
