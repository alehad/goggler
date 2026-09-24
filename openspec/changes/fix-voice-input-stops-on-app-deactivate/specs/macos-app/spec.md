## MODIFIED Requirements

### Requirement: Analytics tab AI assistant accepts voice input

When speech recognition is available on the current Mac, the Analytics tab's AI assistant question field SHALL offer a microphone button that fills the field with recognized speech, without submitting the question automatically.

#### Scenario: Voice input populates the question field

- **GIVEN** the mic button is visible
- **WHEN** the user taps it and speaks
- **THEN** the question field SHALL fill in with the recognized text as it's produced
- **AND** the question SHALL NOT be submitted automatically — the user still submits it explicitly

#### Scenario: Listening stops on tap or on a natural pause

- **GIVEN** the app is listening
- **WHEN** the user taps the mic button again, or a natural pause in speech ends recognition
- **THEN** listening SHALL stop

#### Scenario: Permission denial is surfaced clearly

- **GIVEN** the user denies the microphone or speech-recognition permission
- **WHEN** they attempt to use voice input
- **THEN** the app SHALL show a clear "microphone access denied" message rather than failing silently

#### Scenario: The mic button is hidden when speech recognition is unavailable

- **GIVEN** speech recognition is not available on the current Mac
- **WHEN** the Analytics tab is shown
- **THEN** no mic button SHALL appear

#### Scenario: Listening stops when the app is deactivated

- **GIVEN** the app is listening
- **WHEN** the user switches away from the app entirely (e.g. Cmd+Tab to another app), rather than switching tabs within it
- **THEN** listening SHALL stop
