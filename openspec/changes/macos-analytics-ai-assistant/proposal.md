# Proposal: macOS Analytics AI assistant (text chat)

## Why

The web app's Analytics tab has a natural-language assistant ("what's the highest paid item?") that answers questions about the user's price history and filters the list to the items it referenced. The macOS Analytics tab doesn't have this yet. The backend endpoint it calls (`POST /api/market-insights/chat`) already exists, is non-streaming (one request, one JSON response), and needs no changes — this is purely a native client for an existing, working API.

Voice input (the web app's other assistant-adjacent feature) is deliberately out of scope here — it has no macOS equivalent to port (the web version uses the browser's Speech Recognition API) and would need Apple's `Speech` framework plus new microphone/speech-recognition permissions, a meaningfully separate piece of work. This change is text-chat only; voice is a follow-up change once this lands.

## What Changes

- `AnalyticsView` gains a question field + "Ask" button, shown right after the summary metrics (macOS has no chart yet, unlike web, so there's no chart to sit below).
- Asking a question calls the existing `POST /api/market-insights/chat` with the same request shape the web app sends (`question`, `exactTitleMatch`, `criteriaText`) — reusing the same hardcoded matching-preferences values `BuyingHistoryStore` already sends for the buying-history fetch (macOS has no matching-preferences settings screen yet; extracted into one shared constant so the two call sites can't drift).
- The response (`{ answer: string; itemIds: string[] }`) renders the answer as Markdown (SwiftUI's `AttributedString(markdown:)`, falling back to plain text if parsing fails) and, when `itemIds` is non-empty, filters the Analytics list down to exactly those items in that order — matching the web app's `aiFilterItemIds` short-circuit behavior exactly (it overrides the capture/win-status/search filters entirely while active, not layered on top of them).
- A "Clear" action (shown only while an AI filter is active) resets back to the normal filtered view.

## Out of Scope

- Voice input — a separate, later change (see Why).
- The matched-sales price chart — already deferred from the original Analytics tab change, unaffected by this one.
- Any change to the chat backend (`src/market-insights/chat.ts`, `/api/market-insights/chat`) — reused exactly as-is.
- A matching-preferences settings screen on macOS — this change reuses the existing hardcoded default, same as the rest of the macOS app today.

## Success Criteria

- Asking a question on the macOS Analytics tab returns the same answer the web app would for the same question (same backend, same request shape).
- When the answer references specific items, the list filters to exactly those items, in the order the assistant returned them — and clearing the AI filter restores the normal capture/win-status/search filtering.
- No backend changes; no new permissions or entitlements.
