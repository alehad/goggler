import Anthropic from "@anthropic-ai/sdk";
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import type { MatchingPreferences } from "../ebay/matching-preferences.ts";
import type { EbayBuyingHistoryItem } from "../ebay/trading-client.ts";
import { listAllMarketPriceRecords } from "../persistence/market-price-records.ts";
import { listAllWonItems } from "../persistence/won-items.ts";
import { computeGroupDeals, computeGroupTrends, type GroupDeal, type GroupTrend } from "./price-history.ts";

const ANALYTICS_ASSISTANT_SYSTEM_PROMPT =
  "You answer questions about the signed-in user's own eBay price-history and purchase data, using only " +
  "the results of the tools provided to you. Never guess, estimate, or use outside knowledge for a numeric " +
  "or factual claim — always call a tool first. If a tool returns no matching data, say so plainly instead " +
  "of speculating. Markdown is rendered, so use it for readability, but never invent structure the tool " +
  "results don't support. Pick the format by shape:\n" +
  "- A single fact or item: a few sentences of plain prose, no heading, no list, no table.\n" +
  "- Several items, one value each (e.g. the price of each of several albums): a bullet list, one line per " +
  "item, exactly '- **name**: value'.\n" +
  "- Several items, more than one value each (e.g. average vs. paid vs. difference per album): a Markdown " +
  "table. A table only renders if every row is on its own line with a real line break — copy this shape " +
  "exactly, including the blank line before it and the |---|---|---| separator row:\n" +
  "| Album | Average | Paid | Difference |\n" +
  "|---|---|---|---|\n" +
  "| Example Title | $10.00 | $8.00 | -$2.00 |\n" +
  "Never put more than one row on the same line, and never omit the separator row. Use each item's full " +
  "title exactly as the tool returned it — never shorten or abbreviate it (e.g. drop the artist name or " +
  "catalogue/pressing number), since two items can have similar titles but be different pressings, and " +
  "shortening can make them indistinguishable.\n\n" +
  "If the user asks for results in a specific order (sorted by price, by date, by discount, etc.), pass the " +
  "matching sortBy/sortDirection argument to the tool and present its rows in the order returned. Never sort, " +
  "reorder, or compute derived values (differences, percentages, totals) yourself while writing the answer — " +
  "every number and every ordering must come directly from a tool's output, since manual arithmetic or " +
  "reordering by you is unreliable and has produced wrong answers before.\n\n" +
  "'Paid', 'purchased', 'bought', 'spent', and 'cost' all mean an item the user actually won — always filter " +
  "with won: true for these. An item that is not won only has a current or final listing price, which the " +
  "user never paid; never answer a paid/purchased/spent question with an unwon item's price. If a search for " +
  "the user's purchases with the given filters returns nothing, say so plainly rather than substituting an " +
  "unwon item without saying so. This applies to every tool, not just query_items: compute_trends's " +
  "earliest/latest points each carry their own won field and are not necessarily purchases — check it before " +
  "ever saying 'you bought' or 'you paid' about one of them.\n\n" +
  "Do not use searchText for a generic category or item-type word (e.g. 'record', 'vinyl', 'item', 'card', " +
  "'book') — those describe what kind of thing the item is, not literal text you would expect in its title, " +
  "so filtering on them will wrongly return nothing. Only set searchText for a specific, distinguishing term " +
  "from the question: an artist/brand/seller name, a model or catalogue number, or an exact phrase quoted or " +
  "clearly named by the user. When in doubt, leave searchText unset and rely on the other filters (won, " +
  "price range, sort) instead.\n\n" +
  "You have no memory of any earlier question or answer — each question arrives with zero context of any " +
  "conversation before it, and the user's next message (even a one-word reply like 'yes') will reach a future " +
  "call with no memory of this one either. Because of this, you must NEVER end your answer with a question, " +
  "and must NEVER offer to search further or ask the user for more detail — there is no way for them to " +
  "continue that exchange, so doing so produces a dead end. If a tool call finds nothing, do not ask a " +
  "clarifying question: instead, state plainly that nothing matched, then answer using the closest useful " +
  "thing you can find with a broader or different tool call, clearly labelled as such (e.g. 'no won purchase " +
  "matched that exactly; the closest is ...').";

const MAX_QUESTION_LENGTH = 500;

export type ToolItem = EbayBuyingHistoryItem & { captured: boolean; won: boolean };

export type QueryItemsInput = {
  captured?: boolean;
  won?: boolean;
  sellerUserId?: string;
  minPrice?: number;
  maxPrice?: number;
  searchText?: string;
  sortBy?: "price" | "endTime" | "title";
  sortDirection?: "asc" | "desc";
  limit: number;
};

export type SummarizeItemsInput = {
  captured?: boolean;
  won?: boolean;
};

export type ItemsSummary = {
  currency: string;
  count: number;
  average: number;
  lowest: { itemId: string; title: string; value: number };
  highest: { itemId: string; title: string; value: number };
};

export type RankTrendsInput = {
  direction?: "up" | "down";
  limit: number;
};

export type RankDealsInput = {
  searchText?: string;
  sortBy?: "dealPercent" | "paidValue" | "averageValue" | "differenceValue";
  sortDirection?: "asc" | "desc";
  limit: number;
};

/**
 * Every tool reads from this same union of persisted WonItem + MarketPriceRecord
 * rows, mirroring exactly how the Analytics tab itself merges the two sources
 * (app/page.tsx's Analytics `items` memo) so the assistant's answers agree with
 * what the user sees on screen.
 */
async function loadItems(userId: string): Promise<ToolItem[]> {
  const [wonItems, capturedItems] = await Promise.all([listAllWonItems(userId), listAllMarketPriceRecords(userId)]);

  const wonItemIds = new Set(wonItems.map((item) => item.itemId));
  const capturedRows: ToolItem[] = capturedItems.map((item) => ({
    ...item,
    captured: true,
    won: wonItemIds.has(item.itemId)
  }));

  const capturedIds = new Set(capturedItems.map((item) => item.itemId));
  const wonOnlyRows: ToolItem[] = wonItems
    .filter((item) => !capturedIds.has(item.itemId))
    .map((item) => ({ ...item, captured: false, won: true }));

  return [...capturedRows, ...wonOnlyRows];
}

export type QueryItemsResult = {
  items: ToolItem[];
  searchTextIgnored: boolean;
};

/**
 * When searchText matches nothing, retries without it rather than returning an empty result.
 * A small model reliably passes through a literal word from the user's own question as
 * searchText even for a generic category term (e.g. "record" for "vinyl") — negative prompt
 * instructions telling it not to proved unreliable in practice, so this is handled
 * deterministically here instead, with searchTextIgnored telling the model (and the user,
 * through its phrased answer) that the narrower search came back empty.
 */
export async function queryItems(userId: string, input: QueryItemsInput): Promise<QueryItemsResult> {
  const items = await loadItems(userId);
  const filtered = filterItems(items, input);

  if (filtered.length > 0 || !input.searchText) {
    return { items: sortItems(filtered, input.sortBy, input.sortDirection).slice(0, input.limit), searchTextIgnored: false };
  }

  const { searchText: _searchText, ...withoutSearchText } = input;
  const broaderFiltered = filterItems(items, withoutSearchText);
  return {
    items: sortItems(broaderFiltered, input.sortBy, input.sortDirection).slice(0, input.limit),
    searchTextIgnored: true
  };
}

export async function summarizeItems(userId: string, input: SummarizeItemsInput): Promise<ItemsSummary[]> {
  const items = await loadItems(userId);
  const filtered = filterItems(items, input);
  const priced = filtered.filter((item): item is ToolItem & { currentPrice: NonNullable<ToolItem["currentPrice"]> } =>
    Boolean(item.currentPrice)
  );

  const byCurrency = new Map<string, typeof priced>();
  for (const item of priced) {
    const group = byCurrency.get(item.currentPrice.currency) ?? [];
    group.push(item);
    byCurrency.set(item.currentPrice.currency, group);
  }

  return [...byCurrency.entries()].map(([currency, group]) => {
    const lowest = group.reduce((lowest, item) => (item.currentPrice.value <= lowest.currentPrice.value ? item : lowest));
    const highest = group.reduce((highest, item) => (item.currentPrice.value >= highest.currentPrice.value ? item : highest));
    const average = group.reduce((sum, item) => sum + item.currentPrice.value, 0) / group.length;

    return {
      currency,
      count: group.length,
      average,
      lowest: { itemId: lowest.itemId, title: lowest.title, value: lowest.currentPrice.value },
      highest: { itemId: highest.itemId, title: highest.title, value: highest.currentPrice.value }
    };
  });
}

export async function rankTrends(
  userId: string,
  matchingPreferences: MatchingPreferences,
  input: RankTrendsInput
): Promise<GroupTrend[]> {
  const trends = await computeGroupTrends(userId, matchingPreferences);
  const directed =
    input.direction === "up"
      ? trends.filter((trend) => trend.percentChange > 0)
      : input.direction === "down"
        ? trends.filter((trend) => trend.percentChange < 0)
        : trends;

  const ranked = [...directed].sort((a, b) => Math.abs(b.percentChange) - Math.abs(a.percentChange));
  return ranked.slice(0, input.limit);
}

export type RankDealsResult = {
  deals: GroupDeal[];
  searchTextIgnored: boolean;
};

export async function rankDeals(
  userId: string,
  matchingPreferences: MatchingPreferences,
  input: RankDealsInput
): Promise<RankDealsResult> {
  const deals = await computeGroupDeals(userId, matchingPreferences);
  const matched = filterDealsByTitle(deals, input.searchText);

  if (matched.length > 0 || !input.searchText) {
    return { deals: sortDeals(matched, input.sortBy, input.sortDirection).slice(0, input.limit), searchTextIgnored: false };
  }

  return { deals: sortDeals(deals, input.sortBy, input.sortDirection).slice(0, input.limit), searchTextIgnored: true };
}

function filterDealsByTitle(deals: GroupDeal[], searchText: string | undefined): GroupDeal[] {
  if (!searchText) {
    return deals;
  }
  const term = searchText.toLocaleLowerCase("en-GB");
  return deals.filter((deal) => deal.title.toLocaleLowerCase("en-GB").includes(term));
}

function sortDeals(
  deals: GroupDeal[],
  sortBy: RankDealsInput["sortBy"],
  sortDirection: "asc" | "desc" | undefined
): GroupDeal[] {
  const field = sortBy ?? "dealPercent";
  const direction = sortDirection === "asc" ? 1 : -1;
  return [...deals].sort((a, b) => direction * (a[field] - b[field]));
}

function filterItems(
  items: ToolItem[],
  filter: { captured?: boolean; won?: boolean; sellerUserId?: string; minPrice?: number; maxPrice?: number; searchText?: string }
): ToolItem[] {
  let filtered = items;

  if (filter.captured !== undefined) {
    filtered = filtered.filter((item) => item.captured === filter.captured);
  }
  if (filter.won !== undefined) {
    filtered = filtered.filter((item) => item.won === filter.won);
  }
  if (filter.sellerUserId) {
    const seller = filter.sellerUserId.toLocaleLowerCase("en-GB");
    filtered = filtered.filter((item) => item.sellerUserId?.toLocaleLowerCase("en-GB") === seller);
  }
  if (filter.minPrice !== undefined) {
    const minPrice = filter.minPrice;
    filtered = filtered.filter((item) => item.currentPrice !== undefined && item.currentPrice.value >= minPrice);
  }
  if (filter.maxPrice !== undefined) {
    const maxPrice = filter.maxPrice;
    filtered = filtered.filter((item) => item.currentPrice !== undefined && item.currentPrice.value <= maxPrice);
  }
  if (filter.searchText) {
    const term = filter.searchText.toLocaleLowerCase("en-GB");
    filtered = filtered.filter((item) => item.title.toLocaleLowerCase("en-GB").includes(term));
  }

  return filtered;
}

function sortItems(
  items: ToolItem[],
  sortBy: "price" | "endTime" | "title" | undefined,
  sortDirection: "asc" | "desc" | undefined
): ToolItem[] {
  if (!sortBy) {
    return items;
  }

  const direction = sortDirection === "desc" ? -1 : 1;
  return [...items].sort((a, b) => {
    if (sortBy === "price") {
      return direction * ((a.currentPrice?.value ?? 0) - (b.currentPrice?.value ?? 0));
    }
    if (sortBy === "endTime") {
      return direction * (Date.parse(a.endTime ?? "") - Date.parse(b.endTime ?? ""));
    }
    return direction * a.title.localeCompare(b.title, "en-GB");
  });
}

function toItemSummary(item: ToolItem) {
  // item.list ("WatchList"/"WonList") reflects which persisted table the row came from, not
  // whether it was won — a won item that also has a captured MarketPriceRecord keeps
  // list: "WatchList". Deliberately omitted here since the model previously misread it as a
  // won/not-won signal and used it instead of the actual `won` field.
  return {
    itemId: item.itemId,
    title: item.title,
    captured: item.captured,
    won: item.won,
    price: item.currentPrice?.value,
    currency: item.currentPrice?.currency,
    endTime: item.endTime,
    sellerUserId: item.sellerUserId
  };
}

function buildTools(userId: string, matchingPreferences: MatchingPreferences, referencedItemIds: string[]) {
  const queryItemsTool = betaZodTool({
    name: "query_items",
    description:
      "Filter and sort the user's captured price-history items and won purchases. Use this to find a " +
      "specific item or a small set of items (e.g. the most expensive item, items from a given seller).",
    inputSchema: z.object({
      captured: z.boolean().optional().describe("Only items already captured into price history"),
      won: z
        .boolean()
        .optional()
        .describe(
          "true = only items the user actually won and paid for. Set this for any question about what the " +
            "user paid, purchased, bought, spent, or was charged — an item that was never won only has a " +
            "listing price, not a payment."
        ),
      sellerUserId: z.string().optional(),
      minPrice: z.number().optional(),
      maxPrice: z.number().optional(),
      searchText: z
        .string()
        .optional()
        .describe(
          "Case-insensitive substring match against the item title. Only for a specific term likely to appear " +
            "literally in a title (artist/brand name, model/catalogue number, exact phrase) — never a generic " +
            "category word like 'record' or 'item', which won't appear verbatim and will wrongly match nothing."
        ),
      sortBy: z.enum(["price", "endTime", "title"]).optional(),
      sortDirection: z.enum(["asc", "desc"]).optional(),
      limit: z.number().int().min(1).max(50).default(20)
    }),
    run: async (input) => {
      const { items: results, searchTextIgnored } = await queryItems(userId, input);
      referencedItemIds.push(...results.map((item) => item.itemId));
      return JSON.stringify({
        items: results.map(toItemSummary),
        ...(searchTextIgnored
          ? { note: "searchText matched nothing, so it was ignored — these are the broader results without it. Say so in your answer." }
          : {})
      });
    }
  });

  const computeTrendsTool = betaZodTool({
    name: "compute_trends",
    description:
      "Rank relisting groups by price trend (earliest vs. latest dated sale) across the user's whole " +
      "history. Use this for questions about items trending up or down in price over time. NOT for " +
      "'best purchase'/'best deal'/'cheapest vs average' questions — use rank_purchase_deals for those. " +
      "The earliest/latest point returned is not necessarily something the user won — each carries its own " +
      "won field; never describe a point as 'you bought/paid' unless won is true for it.",
    inputSchema: z.object({
      direction: z.enum(["up", "down"]).optional().describe("Only rising (up) or only falling (down) trends"),
      limit: z.number().int().min(1).max(20).default(5)
    }),
    run: async (input) => {
      const results = await rankTrends(userId, matchingPreferences, input);
      referencedItemIds.push(...results.map((trend) => trend.latest.itemId));
      return JSON.stringify(results);
    }
  });

  const rankDealsTool = betaZodTool({
    name: "rank_purchase_deals",
    description:
      "Lists every one of the user's own won purchases with how good a deal each was: paidValue, averageValue, " +
      "differenceValue (paidValue - averageValue; negative = paid below average), dealPercent (how far " +
      "below/above average, as a %), and saleCount (how many dated sales, including this purchase, the " +
      "average is drawn from). Use this for 'best purchase', 'best deal', 'cheapest vs average', or 'how much " +
      "did I pay vs average for each of my <artist/item> purchases' questions — this is also the right tool " +
      "for 'list everything I bought for <artist/item>' even without a deal angle, since it returns every won " +
      "purchase. When saleCount is 1, the average is just that purchase's own price (there's no independent " +
      "market reference) — still report it as a real average and $0/0% difference, but mention in your answer " +
      "that it's based on a single sale so the reader knows not to read it as a market comparison. Every " +
      "result is a real purchase the user actually made. If the user asks for a specific sort order (e.g. " +
      "'sort by what I paid'), pass it via sortBy/sortDirection and present the rows in that exact returned " +
      "order — do not reorder them yourself when writing the answer, since manual " +
      "reordering is unreliable.",
    inputSchema: z.object({
      searchText: z
        .string()
        .optional()
        .describe(
          "Case-insensitive substring match against the item title, to scope to one artist/brand/model — " +
            "e.g. an artist name from the question. Never a generic category word like 'record' or 'vinyl'."
        ),
      sortBy: z
        .enum(["dealPercent", "paidValue", "averageValue", "differenceValue"])
        .optional()
        .describe("What to sort by. Default dealPercent (best deal first)."),
      sortDirection: z.enum(["asc", "desc"]).optional().describe("Default desc (so dealPercent defaults to best-deal-first)"),
      limit: z.number().int().min(1).max(50).default(5)
    }),
    run: async (input) => {
      const { deals: results, searchTextIgnored } = await rankDeals(userId, matchingPreferences, input);
      referencedItemIds.push(...results.map((deal) => deal.wonItemId));
      return JSON.stringify({
        deals: results,
        ...(searchTextIgnored
          ? { note: "searchText matched nothing, so it was ignored — these are the broader results without it. Say so in your answer." }
          : {})
      });
    }
  });

  const summarizeItemsTool = betaZodTool({
    name: "summarize_items",
    description:
      "Count/average/lowest/highest over a filtered set of the user's items, grouped by currency. Use this " +
      "for aggregate questions (e.g. how many items, what's the average price) rather than a single item.",
    inputSchema: z.object({
      captured: z.boolean().optional(),
      won: z
        .boolean()
        .optional()
        .describe("true = only items the user actually won and paid for (set this for spend/paid/purchased questions)")
    }),
    run: async (input) => {
      const results = await summarizeItems(userId, input);
      referencedItemIds.push(...results.flatMap((summary) => [summary.lowest.itemId, summary.highest.itemId]));
      return JSON.stringify(results);
    }
  });

  return [queryItemsTool, computeTrendsTool, rankDealsTool, summarizeItemsTool];
}

export async function answerAnalyticsQuestion(
  userId: string,
  question: string,
  matchingPreferences: MatchingPreferences,
  client: Anthropic = new Anthropic()
): Promise<{ answer: string; itemIds: string[] }> {
  const boundedQuestion = question.trim().slice(0, MAX_QUESTION_LENGTH);
  const referencedItemIds: string[] = [];
  const tools = buildTools(userId, matchingPreferences, referencedItemIds);

  const finalMessage = await client.beta.messages.toolRunner({
    model: "claude-haiku-4-5",
    max_tokens: 1024,
    system: ANALYTICS_ASSISTANT_SYSTEM_PROMPT,
    tools,
    messages: [{ role: "user", content: boundedQuestion }]
  });

  const answer = finalMessage.content.find((block) => block.type === "text")?.text ?? "";
  return { answer, itemIds: [...new Set(referencedItemIds)] };
}
