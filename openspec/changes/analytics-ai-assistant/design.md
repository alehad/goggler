# Design: Natural-language Q&A over the Analytics list

## New data function: `computeGroupTrends`

`src/market-insights/price-history.ts` (alongside the existing `listMatchedSales`/`listMatchedSalesSummaries`):

```ts
export type GroupTrend = {
  relistingGroupId: string;
  title: string; // representative title (most recent sale's title)
  currency: string;
  saleCount: number;
  earliest: { value: number; endedAt: string };
  latest: { value: number; endedAt: string };
  percentChange: number; // (latest - earliest) / earliest * 100
};

export async function computeGroupTrends(
  userId: string,
  matchingPreferences: MatchingPreferences
): Promise<GroupTrend[]>
```

Implementation: read all `WonItem` + `MarketPriceRecord` rows for the user (same `listAllWonItems`/`listAllMarketPriceRecords` functions [[watchlist-automation]] already introduced), group by `(relistingGroupId, currency)` using the same `groupForHistoryTitle` grouping logic `captureMarketPriceRecords` already uses, keep only groups with 2+ dated price points, sort each group's points by date, and compute `percentChange` from the earliest to the latest. Returns every qualifying group — the tool layer (below) does the ranking/limiting, not this function, so it stays a plain data query consistent with the rest of this file.

## New tools, executed server-side

`src/market-insights/chat.ts` (new file) — three Zod-typed tools, each backed by a real query against the signed-in user's own data:

```ts
import { z } from "zod";
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";

const queryItemsTool = betaZodTool({
  name: "query_items",
  description: "Filter and sort the user's captured price-history items and won purchases.",
  inputSchema: z.object({
    captured: z.boolean().optional(),
    won: z.boolean().optional(),
    sellerUserId: z.string().optional(),
    minPrice: z.number().optional(),
    maxPrice: z.number().optional(),
    searchText: z.string().optional(),
    sortBy: z.enum(["price", "endTime", "title"]).optional(),
    sortDirection: z.enum(["asc", "desc"]).optional(),
    limit: z.number().int().min(1).max(50).default(20)
  }),
  run: async (input) => queryItems(userId, input) // closes over the request's userId
});

const computeTrendsTool = betaZodTool({
  name: "compute_trends",
  description: "Rank relisting groups by price trend (earliest vs. latest sale) for the user's history.",
  inputSchema: z.object({
    direction: z.enum(["up", "down"]).optional(),
    limit: z.number().int().min(1).max(20).default(5)
  }),
  run: async (input) => rankTrends(userId, input)
});

const summarizeItemsTool = betaZodTool({
  name: "summarize_items",
  description: "Count/average/min/max over a filtered set of the user's items, grouped by currency.",
  inputSchema: z.object({
    captured: z.boolean().optional(),
    won: z.boolean().optional()
    // same filter subset as query_items, no sort/limit — this is an aggregate
  }),
  run: async (input) => summarizeItems(userId, input)
});
```

**No `list` filter.** An earlier version exposed `list: "WatchList" | "WonList"` (mirroring `EbayBuyingHistoryItem.list`) alongside `won`. Live testing (2026-08-24) caught Claude Haiku combining `list: "WonList"` with `won: true` for a "highest paid" question, expecting it to mean "only won items" — but `list` actually reflects which persisted table a row came from, not whether it was won: an item that's in both `MarketPriceRecord` (captured) and `WonItem` (because the exact same listing was later won) keeps `list: "WatchList"`, so the filter silently excluded it and returned a lower-priced item as the answer. `won` alone is the correct and only signal for "did the user actually buy this" — `list` was a leaky implementation detail with no real question it answers that `captured`/`won` don't already cover, so it was removed from both tools' schemas and from the JSON each tool returns to the model, rather than trying to prompt around the ambiguity.

Each `run` function is a real Prisma-backed query — `queryItems`/`summarizeItems` read the same `WonItem`/`MarketPriceRecord` union the Analytics tab already computes (`listAllWonItems` + `listAllMarketPriceRecords`, filtered/sorted in memory — the dataset is small enough that this doesn't need a dedicated SQL query path); `rankTrends` calls `computeGroupTrends` and slices/sorts by the requested direction. Each `run` returns `JSON.stringify(...)` of its result (the Tool Runner's `run` return type is a string or content blocks, not raw objects). **Every tool result is also captured into a closure-scoped array of referenced item IDs as it runs** — that's what becomes the route's `itemIds` response field, so the UI knows what to highlight regardless of which tool(s) Claude called. For `compute_trends`, the referenced ID is each ranked group's most recent sale (`GroupTrend.latest.itemId`), since a trend is about a group, not a single item.

## Orchestration

```ts
export async function answerAnalyticsQuestion(
  userId: string,
  question: string,
  matchingPreferences: MatchingPreferences
): Promise<{ answer: string; itemIds: string[] }> {
  const client = new Anthropic();
  const referencedItemIds: string[] = [];
  const tools = buildTools(userId, matchingPreferences, referencedItemIds); // closes over the accumulator

  // Awaiting toolRunner directly resolves the agentic loop to its final message.
  const finalMessage = await client.beta.messages.toolRunner({
    model: "claude-haiku-4-5",
    max_tokens: 1024,
    system: ANALYTICS_ASSISTANT_SYSTEM_PROMPT,
    tools,
    messages: [{ role: "user", content: question }]
  });
  const answer = finalMessage.content.find((block) => block.type === "text")?.text ?? "";

  return { answer, itemIds: [...new Set(referencedItemIds)] };
}
```

The system prompt states the assistant's scope plainly: it answers questions about the user's own eBay price-history/purchase data using the provided tools, and only the provided tools — no general knowledge, no speculation beyond what a tool call returns.

Two more rules were added to the prompt after live testing (2026-08-24) surfaced real failures, both stemming from the same root cause — the model reasoning as if it were in an ongoing conversation, when each question is actually a fresh, memoryless call:
- **"Paid"/"purchased"/"bought"/"spent" must map to `won: true`.** Without this, a "highest paid" question could be answered from an unwon watchlist item's listing price — which the user never paid — because `query_items` sorted by price with no `won` filter includes both.
- **Never end an answer with a question, or invite the user to reply.** The first live test asked "what's the highest paid record" and got a wrong-item answer that ended with "would you like me to search your purchases instead?" — the user replied "yes", which arrived at the next call with zero memory of the prior exchange, producing a dead end ("I don't have any context for your purchases..."). The stateless design was already a deliberate, agreed tradeoff (see below); the fix is to make sure the assistant never behaves as if it isn't stateless.
- Related: `searchText` was documented (in both the system prompt and the tool schema) to warn against generic category words ("record", "vinyl", "item") that won't appear literally in a title — the same live test tried `searchText: "record"` after being told to search "purchases" and got zero results, compounding the dead-end above.

**The prompt fix for `searchText` was not sufficient on its own.** A second round of live testing (still 2026-08-24) reproduced the same empty-`searchText: "record"` failure twice more, even though the prompt explicitly named "record" as an example to avoid — a small model's adherence to a negative instruction is unreliable, especially when the literal word appears in the user's own question. `queryItems` now handles this deterministically instead of relying on the model to self-correct: if a `searchText` filter matches nothing, it silently retries the same query without it and returns `searchTextIgnored: true` in the tool result, which the model is told to mention in its answer. This fixes the failure regardless of what the model chooses to pass as `searchText`, and does not depend on prompt-following at all.

## New API route: `POST /api/market-insights/chat`

Same shape as every other route in this app:
- `validateSameOriginRequest` (CSRF) → 403.
- `getOrCreateCurrentUser(request)` — session only, **no `requireSessionEbayAccessToken`** — this route never calls eBay, only reads already-persisted data.
- Body: `{ question: string }`, bounded length (e.g. 500 chars, matching the existing `MAX_STRING_LENGTH` convention used elsewhere).
- Calls `answerAnalyticsQuestion`; on any Anthropic SDK error, returns 502 with a generic message (never surface raw API error detail to the client) and logs a warning server-side, same pattern as every other route's `catch` block.

## UI: chatbox on the Analytics tab

- A text input + submit button, positioned above the item list (near the existing search box).
- On submit: `POST` to the new route, show a loading state, then render the returned `answer` text and set a new `aiFilterItemIds: string[] | undefined` state.
- When `aiFilterItemIds` is set, `filteredItems` is narrowed to exactly those IDs (in the order the assistant returned them) instead of the normal search/filter chain — with a visible "Clear" action that resets `aiFilterItemIds` to `undefined` and returns to the regular list.
- Deliberately stateless per question — no conversation history is sent on the next question. A short "recent questions" list (client-side only, not sent back to the model) is a reasonable nice-to-have, not required for v1.
- The answer is rendered with `react-markdown` + `remark-gfm` (bold, bullet lists, and Markdown tables all render properly rather than showing raw `**`/`|` syntax). Item titles reaching the model are real eBay listing titles — third-party content any seller controls, not sanitized on capture — so a title containing Markdown image/link syntax could otherwise render as a live, unsanitized `<img>`/`<a>` once echoed back in an answer (confirmed live during the dual security-review gate: an `![](https://attacker.example/beacon.gif)`-style title would fire a zero-click cross-origin request the moment an answer referencing that item rendered). Fixed by routing the chatbox's rendered `img`/`a` elements through the same `safeEbayImageUrl`/`safeEbayItemUrl` allow-list (`src/http/safe-external-url.ts`) already used for images/links displayed directly from the API elsewhere in `app/page.tsx` — anything not on eBay's own domains is dropped (images) or degrades to plain text (links), verified empirically to preserve real eBay content while blocking the malicious case.

## Environment / setup

- `ANTHROPIC_API_KEY` — the SDK's own standard variable name, so a bare `new Anthropic()` picks it up with no extra plumbing (consistent with "reuse standard conventions" rather than wrapping it in a `GOGGLER_`-prefixed name for no reason).
- The user creates the Anthropic Console account, generates the key, and **sets their own spend limit (e.g. $10/month) directly in Console → Settings → Billing → Spend limits** before this goes live — a hard cap, confirmed during this change's design discussion, not something Claude configures on their behalf.
- New npm dependencies: `@anthropic-ai/sdk`, `zod`.

## Why this shape

- **Tool Runner over the Agent SDK or a hand-rolled loop**: this is exactly the "custom-tool agent without hand-writing the loop" case the Tool Runner exists for — three small tools, no built-in filesystem/bash tools needed, no reason to own the request/response loop by hand.
- **Haiku, not Sonnet/Opus**: tool selection from a small, fixed vocabulary plus phrasing a sentence from an already-correct result is squarely a "classification/simple Q&A" task, not one that benefits from a larger model's deeper reasoning — and cost scales linearly with every question asked, so the cheaper model is the right default here specifically (not a general "always use the cheapest model" stance).
- **No eBay OAuth dependency**: everything this feature answers questions about is already-persisted, settled data (won items, captured price history) — it was a deliberate design choice to keep this route independent of whether the user currently has an active eBay session, which also means it works identically for a future native client that hasn't necessarily done the eBay login dance yet.
- **Referenced-item tracking via closure, not re-deriving from the answer text**: parsing item references back out of free-form model text would be fragile; capturing exactly what each tool actually returned is precise and requires no parsing.
- **Stateless questions**: keeps cost flat and the design simple; multi-turn memory is a real feature but adds real complexity (context accumulation, when to reset, cost growth per turn) that isn't justified until the single-shot version proves useful.

## Testing

- Unit tests for `computeGroupTrends`: correct percent-change direction/magnitude, groups with only 1 data point excluded, per-currency separation (a group with both GBP and USD sales doesn't get incorrectly merged).
- Unit tests for each tool's underlying query function (`queryItems`, `summarizeItems`, `rankTrends`) directly, independent of the Claude API — these are the parts that must be correct regardless of what the model does.
- Integration test (persistence-backed) for `answerAnalyticsQuestion` with a **mocked Anthropic client** (no real API calls in the test suite — same principle as mocking eBay's API in existing tests): verify a tool-call round-trip produces the expected `itemIds`, and that the full item dataset is never present in the constructed request (only the question and tool schemas).
- Manual confirmation: real questions against real captured data, cross-checked against the Analytics page's own numbers (e.g. sort by price manually and compare to what the assistant reports as highest-paid).
