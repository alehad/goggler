## MODIFIED Requirements

### Requirement: Voice input transcribes speech to text entirely client-side, then submits through the same path as typed input

Speech-to-text SHALL be implemented as a client-side, browser-native capability (the Web Speech API's `SpeechRecognition`) that produces plain text handed to the same question-submission path as typed input. It SHALL NOT be implemented by sending audio to, or via, the language model API or any goggler backend — goggler's own code never receives or transmits audio. The microphone control SHALL only be shown when the browser supports `SpeechRecognition`; typed input SHALL remain fully available regardless of browser support.

#### Scenario: A transcribed question is indistinguishable from a typed one

- **GIVEN** a client-side voice input feature transcribes speech to text
- **WHEN** that text is submitted as a question
- **THEN** it SHALL go through the exact same API request as a typed question
- **AND** no additional language-model call SHALL be introduced to handle the transcription itself

#### Scenario: Voice input is unavailable in an unsupported browser

- **GIVEN** a browser without `SpeechRecognition` support
- **WHEN** the Analytics tab renders
- **THEN** no microphone control SHALL be shown
- **AND** the typed question input SHALL remain fully functional

#### Scenario: A transcribed question is reviewable before it is sent

- **GIVEN** speech recognition has produced a transcript
- **WHEN** that transcript is placed into the question field
- **THEN** the question SHALL NOT be submitted automatically
- **AND** the user SHALL be able to edit or clear it before choosing to submit it

#### Scenario: A microphone permission denial does not break typed input

- **GIVEN** the user denies microphone access when prompted
- **WHEN** the denial is reported by the browser
- **THEN** the system SHALL surface a plain-language error near the chatbox
- **AND** the typed question input and submit flow SHALL continue to work unaffected
