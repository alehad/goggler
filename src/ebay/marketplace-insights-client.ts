import type { EbayConfig } from "./config.ts";
import type { EbayMoney } from "./trading-client.ts";

export const MARKET_HISTORY_LOOKBACK_DAYS = 90;

export type EbayMarketSale = {
  itemId: string;
  title: string;
  price: EbayMoney;
  soldAt: string;
  imageUrl?: string;
  itemWebUrl?: string;
};

export type MarketHistoryStats = {
  highest?: EbayMoney;
  median?: EbayMoney;
  lowest?: EbayMoney;
  count: number;
};

export type EbayMarketHistory = {
  query: string;
  lookbackDays: number;
  sales: EbayMarketSale[];
  stats: MarketHistoryStats;
};

export class EbayMarketplaceInsightsError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
  }
}

export async function fetchEbayMarketHistory(
  config: EbayConfig,
  appAccessToken: string,
  query: string,
  options: { fetch?: typeof fetch; limit?: number } = {}
): Promise<EbayMarketHistory> {
  assertTrustedMarketplaceInsightsApiUrl(config);
  const boundedQuery = boundedMarketQuery(query);
  if (!boundedQuery) {
    throw new EbayMarketplaceInsightsError("Marketplace Insights query was empty");
  }

  const url = new URL(config.marketplaceInsightsApiUrl);
  url.searchParams.set("q", boundedQuery);
  url.searchParams.set("limit", String(options.limit ?? 50));

  const response = await (options.fetch ?? fetch)(url, {
    headers: {
      Authorization: `Bearer ${appAccessToken}`,
      "X-EBAY-C-MARKETPLACE-ID": config.marketplaceId
    }
  });

  if (!response.ok) {
    throw new EbayMarketplaceInsightsError(`Marketplace Insights request failed with status ${response.status}`, response.status);
  }

  const body = await response.json();
  const sales = parseMarketSales(body);
  return {
    query: boundedQuery,
    lookbackDays: MARKET_HISTORY_LOOKBACK_DAYS,
    sales,
    stats: buildMarketHistoryStats(sales)
  };
}

export function buildMarketHistoryStats(sales: EbayMarketSale[]): MarketHistoryStats {
  if (sales.length === 0) {
    return { count: 0 };
  }

  const sorted = [...sales].sort((left, right) => left.price.value - right.price.value);
  const middle = Math.floor(sorted.length / 2);
  const currency = sorted[0].price.currency;
  const medianValue =
    sorted.length % 2 === 0
      ? (sorted[middle - 1].price.value + sorted[middle].price.value) / 2
      : sorted[middle].price.value;

  return {
    highest: sorted[sorted.length - 1].price,
    median: { value: medianValue, currency },
    lowest: sorted[0].price,
    count: sorted.length
  };
}

export function boundedMarketQuery(query: string): string {
  return query
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

function parseMarketSales(body: unknown): EbayMarketSale[] {
  if (!body || typeof body !== "object") {
    return [];
  }

  const value = body as { itemSales?: unknown; itemSummaries?: unknown };
  const rawItems = Array.isArray(value.itemSales)
    ? value.itemSales
    : Array.isArray(value.itemSummaries)
      ? value.itemSummaries
      : [];

  return rawItems
    .flatMap((raw): EbayMarketSale[] => {
      const sale = parseMarketSale(raw);
      return sale ? [sale] : [];
    })
    .sort((left, right) => Date.parse(left.soldAt) - Date.parse(right.soldAt));
}

function parseMarketSale(raw: unknown): EbayMarketSale | undefined {
  if (!raw || typeof raw !== "object") {
    return undefined;
  }

  const item = raw as Record<string, unknown>;
  const itemId = stringValue(item.itemId);
  const title = stringValue(item.title);
  const price = moneyValue(item.price) ?? moneyValue(item.soldPrice) ?? moneyValue(item.currentBidPrice);
  const soldAt =
    stringValue(item.itemEndDate) ??
    stringValue(item.itemSoldDate) ??
    stringValue(item.soldDate) ??
    stringValue(item.lastSoldDate);

  if (!itemId || !title || !price || !soldAt || Number.isNaN(Date.parse(soldAt))) {
    return undefined;
  }

  return {
    itemId,
    title,
    price,
    soldAt,
    imageUrl: imageUrlValue(item.image) ?? firstImageUrlValue(item.thumbnailImages),
    itemWebUrl: stringValue(item.itemWebUrl) ?? stringValue(item.itemAffiliateWebUrl)
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

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function assertTrustedMarketplaceInsightsApiUrl(config: EbayConfig): void {
  const url = new URL(config.marketplaceInsightsApiUrl);
  const host = url.hostname.toLocaleLowerCase("en-GB");
  const validHost = host === "api.ebay.com" || host === "api.sandbox.ebay.com";
  const validPath = url.pathname === "/buy/marketplace_insights/v1_beta/item_sales/search";
  if (url.protocol !== "https:" || !validHost || !validPath) {
    throw new EbayMarketplaceInsightsError("Marketplace Insights API URL is not trusted");
  }
}
