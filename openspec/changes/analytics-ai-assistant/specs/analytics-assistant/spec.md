## ADDED Requirements

### Requirement: Natural-language questions are answered from real, deterministically-computed data

The system SHALL answer natural-language questions about the user's captured price-history and purchase data by having a language model select from a small set of server-executed data queries, never by having the model read or summarize the raw dataset itself.

#### Scenario: The full dataset is never sent to the model

- **GIVEN** a user asks a question about their price history
- **WHEN** the system constructs the request sent to the language model
- **THEN** the request SHALL contain only the question and the available tool definitions
- **AND** it SHALL NOT contain the user's item records

#### Scenario: Numeric/factual answers come from real computation

- **GIVEN** a question whose answer depends on comparing or aggregating numeric data (e.g. highest price, price trend, average)
- **WHEN** the system answers it
- **THEN** the answer SHALL be derived from a real, independently-verifiable server-side computation over the user's actual data
- **AND** the language model's role SHALL be limited to selecting which computation to run and phrasing the result in natural language

#### Scenario: Trend ranking requires multiple data points

- **GIVEN** a relisting group with fewer than two dated sale records
- **WHEN** trend ranking runs
- **THEN** that group SHALL be excluded from trend results, not assigned a fabricated or zero trend

### Requirement: The Q&A endpoint is a plain, client-agnostic API

The system SHALL expose this capability as a standalone JSON API endpoint requiring only the caller's own session, independent of any particular frontend, so it is reusable from a future native client as well as the web UI.

#### Scenario: No eBay session is required to ask a question

- **GIVEN** a signed-in user without an active eBay OAuth session
- **WHEN** they ask a question about their existing captured/purchase history
- **THEN** the system SHALL answer it, since it only reads already-persisted data

#### Scenario: The response identifies which real items were referenced

- **GIVEN** an answered question
- **WHEN** the response is returned
- **THEN** it SHALL include the specific item IDs any tool call actually returned
- **AND** those IDs SHALL correspond to real records the user owns, not IDs inferred from the model's free-form text

### Requirement: Voice input, when added later, never involves the language model

Speech-to-text SHALL be implemented as a client-side, platform-native capability that produces plain text handed to the same question-submission path as typed input — it SHALL NOT be implemented by sending audio to, or via, the language model API.

#### Scenario: A transcribed question is indistinguishable from a typed one

- **GIVEN** a future client-side voice input feature transcribes speech to text
- **WHEN** that text is submitted as a question
- **THEN** it SHALL go through the exact same API request as a typed question
- **AND** no additional language-model call SHALL be introduced to handle the transcription itself
