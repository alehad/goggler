import type { EbayConfig } from "./config.ts";
import type { HomeFeedRow } from "./home-feed.ts";
import type { EbayMoney } from "./trading-client.ts";
import { relistingGroupForTitle, type MatchingPreferences } from "./matching-preferences.ts";

export type EbayBrowseSearchResponse = {
  source: "live";
  query: string;
  rows: HomeFeedRow[];
  total?: number;
};

export class EbayBrowseApiError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
  }
}

export async function fetchEbayBrowseSearchResponse(
  config: EbayConfig,
  appAccessToken: string,
  query: string,
  options: { fetch?: typeof fetch; limit?: number; matchingPreferences: MatchingPreferences } 
): Promise<EbayBrowseSearchResponse> {
  assertTrustedBrowseApiUrl(config);
  const boundedQuery = boundedBrowseQuery(query);
  if (!boundedQuery) {
    throw new EbayBrowseApiError("Browse search query was empty");
  }

  const url = new URL(config.browseApiUrl);
  url.searchParams.set("q", boundedQuery);
  url.searchParams.set("limit", String(options.limit ?? 50));
  url.searchParams.set("filter", "buyingOptions:{AUCTION|FIXED_PRICE}");

  const response = await (options.fetch ?? fetch)(url, {
    headers: {
      Authorization: `Bearer ${appAccessToken}`,
      "X-EBAY-C-MARKETPLACE-ID": config.marketplaceId
    }
  });

  if (!response.ok) {
    throw new EbayBrowseApiError(`Browse search request failed with status ${response.status}`, response.status);
  }

  const body = await response.json();
  return {
    source: "live",
    query: boundedQuery,
    rows: parseBrowseRows(body, options.matchingPreferences),
    total: numberValue((body as { total?: unknown }).total)
  };
}

export function boundedBrowseQuery(query: string): string {
  return query
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

function parseBrowseRows(body: unknown, matchingPreferences: MatchingPreferences): HomeFeedRow[] {
  if (!body || typeof body !== "object") {
    return [];
  }

  const rawItems = (body as { itemSummaries?: unknown }).itemSummaries;
  if (!Array.isArray(rawItems)) {
    return [];
  }

  return rawItems.flatMap((raw): HomeFeedRow[] => {
    const row = parseBrowseRow(raw, matchingPreferences);
    return row ? [row] : [];
  });
}

function parseBrowseRow(raw: unknown, matchingPreferences: MatchingPreferences): HomeFeedRow | undefined {
  if (!raw || typeof raw !== "object") {
    return undefined;
  }

  const item = raw as Record<string, unknown>;
  const itemId = stringValue(item.itemId) ?? stringValue(item.legacyItemId);
  const title = stringValue(item.title);
  if (!itemId || !title) {
    return undefined;
  }

  const price = moneyValue(item.price) ?? moneyValue(item.currentBidPrice);
  const itemWebUrl = stringValue(item.itemWebUrl);
  const imageUrl = imageUrlValue(item.image) ?? firstImageUrlValue(item.thumbnailImages);
  const endsAt = stringValue(item.itemEndDate);
  const sellerUserId = sellerUserIdValue(item.seller);
  const conditionDisplayName = stringValue(item.condition);
  const relistingGroupId = relistingGroupForTitle(title, matchingPreferences);
  const buyingOptions = Array.isArray(item.buyingOptions) ? item.buyingOptions.filter((value): value is string => typeof value === "string") : [];

  return {
    id: `search-${itemId}`,
    section: "search_result",
    title,
    currentPrice: price,
    endsAt,
    sellerUserId,
    conditionDisplayName,
    imageUrl,
    itemWebUrl,
    matchSignals: buyingOptions,
    relistingGroupId,
    sourceItemId: itemId,
    tags: ["Live eBay listing"],
    actions: itemWebUrl ? ["open_on_ebay"] : []
  };
}

function moneyValue(raw: unknown): EbayMoney | undefined {
  if (!raw || typeof raw !== "object") {
    return undefined;
  }

  const money = raw as { value?: unknown; currency?: unknown; currencyId?: unknown };
  const value = typeof money.value === "string" ? Number(money.value) : money.value;
  const currency = stringValue(money.currency) ?? stringValue(money.currencyId);
  if (!Number.isFinite(value) || typeof value !== "number" || value < 0 || !currency) {
    return undefined;
  }

  return { value, currency };
}

function firstImageUrlValue(raw: unknown): string | undefined {
  if (!Array.isArray(raw)) {
    return undefined;
  }

  return imageUrlValue(raw[0]);
}

function imageUrlValue(raw: unknown): string | undefined {
  if (!raw || typeof raw !== "object") {
    return undefined;
  }

  return stringValue((raw as { imageUrl?: unknown }).imageUrl);
}

function sellerUserIdValue(raw: unknown): string | undefined {
  if (!raw || typeof raw !== "object") {
    return undefined;
  }

  return stringValue((raw as { username?: unknown }).username);
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function assertTrustedBrowseApiUrl(config: EbayConfig): void {
  const url = new URL(config.browseApiUrl);
  const host = url.hostname.toLocaleLowerCase("en-GB");
  const validHost = host === "api.ebay.com" || host === "api.sandbox.ebay.com";
  const validPath = url.pathname === "/buy/browse/v1/item_summary/search";
  if (url.protocol !== "https:" || !validHost || !validPath) {
    throw new EbayBrowseApiError("Browse API URL is not trusted");
  }
}
