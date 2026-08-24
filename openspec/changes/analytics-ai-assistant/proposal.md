# Proposal: Natural-language Q&A over the Analytics list

## Why

The Analytics tab shows a growing list of captured price-history items (currently ~190 records) with search and filter controls, but answering a question like "what's my highest paid item?" or "which record has the biggest upward price trend?" means manually sorting/filtering and eyeballing the list. The user wants to just ask, in a chatbox on that tab, and get a spoken-language answer with the relevant items surfaced in the list.

## Why this shape (the core design decision)

The naive approach — hand the model the whole item list and ask it to answer — is the wrong one, for two independent reasons discussed and agreed before drafting this proposal:

1. **Accuracy.** Asking an LLM to read numeric data across ~190 rows and find the max, or eyeball a trend, is exactly the kind of task where a wrong answer is plausible-looking and easy to miss. This app already computes these things deterministically (`listMatchedSales`, `listMatchedSalesSummaries`, `buildPurchaseChartPoints`) — the assistant should use that same real computation, not re-derive it via the model.
2. **Cost and portability.** Sending the full dataset on every question means cost grows with history size and repeats already-known data every time. Instead: Claude's only job is translating the natural-language question into a small structured tool call; the app executes that tool as a real, deterministic database query; Claude phrases the final answer from the real, already-correct result.

Concretely: **Claude API + Tool Runner** (`@anthropic-ai/sdk`, `client.beta.messages.toolRunner`) — not the separate Claude Agent SDK (that's Claude Code packaged as a library, wrong tool for a simple structured-query assistant) — with **Claude Haiku 4.5** (`claude-haiku-4-5`), which is the appropriate tier for "pick the right tool and phrase a sentence," not "reason deeply." Estimated real-world cost: fractions of a cent per question, since the model never sees the raw dataset — only the question and a small, fixed tool schema.

## What Changes

- **Three new tools**, executed server-side against real `WonItem`/`MarketPriceRecord` data, scoped to the signed-in user:
  - `queryItems` — filter (captured/won/list/seller/price range/search text) and sort the same dataset the Analytics tab already shows; covers "highest paid item," "items I haven't captured," "things from seller X," etc.
  - `computeTrends` — a new aggregate: for every relisting group with 2+ sale data points, the percent change from earliest to latest sale price, ranked by direction/magnitude; covers "biggest upward/downward trend."
  - `summarizeItems` — count/average/min/max over a filtered set, grouped by currency; covers "what's my average paid price," "how many have I captured."
- **New API route**, `POST /api/market-insights/chat` (`{ question: string }` → `{ answer: string, itemIds: string[] }`): session-scoped only (no eBay OAuth needed — this only ever reads already-captured/settled data, the same data Analytics already shows without a live eBay call). Follows the same CSRF/session pattern as every other route here.
- **New chatbox UI** on the Analytics tab: a text input + submit, the answer text, and the list narrowing to just the referenced items (with a clear way back to the full list) — mirrors the "narrow the view, don't replace the page" pattern already used for group filtering.
- **New dependencies**: `@anthropic-ai/sdk`, `zod` (for Tool Runner's typed tool schemas). New environment variable: `ANTHROPIC_API_KEY` (the SDK's standard name — picked up automatically, no `GOGGLER_`-prefixed wrapper needed).
- **Designed for reuse from the future macOS/iOS apps, not just the web UI**: the route is a plain JSON endpoint with no server-rendering or web-specific coupling — a native client can call it the same way, once it has its own way to authenticate to the backend (a general problem for any native-client work, not something new introduced here).

## Explicitly Kept Out of the AI/LLM Space

**Voice input is a future addition, and by design it never touches the Claude API at all.** Speech-to-text is a client-side, platform-native concern:
- Web: the browser's built-in `SpeechRecognition` (Web Speech API).
- macOS/iOS (later): Apple's `SFSpeechRecognizer` (Speech framework).

Both produce plain text and hand it to the exact same "submit a question" boundary a typed question uses — so adding a mic button later is purely additive UI on whichever client, never a backend change and never an extra LLM call. This change doesn't build voice input, but the text-only route contract is what makes it a no-op to add later.

## Out of Scope

- Voice/speech input itself (see above — deliberately deferred, and structurally already accounted for).
- Multi-turn conversational memory — each question is answered independently (stateless), not threaded into an ongoing conversation. Simpler to build and reason about; revisit if the user wants follow-up questions that reference earlier answers.
- The macOS/iOS apps themselves, and their auth mechanism against this API.
- A fallback to a larger model (e.g. Sonnet) for harder questions — start Haiku-only; only add this if real usage shows it struggling.

## Success Criteria

- Asking "what's my highest paid item?" (or equivalent phrasing) returns a correct answer, verified against a real, independently-computed number — not something the model asserts.
- Asking about trend direction returns groups actually computed from real sale history, not a hallucinated ranking.
- The full item dataset is never included in the request sent to Claude — verified by inspecting the actual request payload.
- The Analytics list visibly narrows to the referenced items after an answer, with an obvious way back to the unfiltered view.
- A real spend cap (set by the user directly in the Anthropic Console, not by Claude) is in place before this ships to real usage.
