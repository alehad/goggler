import type { EbayConfig } from "./config.ts";

export type EbayBuyingListKind = "LostList" | "WonList";

export type EbayMoney = {
  value: number;
  currency: string;
};

export type EbayBuyingHistoryItem = {
  itemId: string;
  title: string;
  list: EbayBuyingListKind;
  currentPrice?: EbayMoney;
  endTime?: string;
  sellerUserId?: string;
  conditionDisplayName?: string;
  relistingGroupId?: string;
};

export type GetMyeBayBuyingInput = {
  list: EbayBuyingListKind;
  pageNumber?: number;
  entriesPerPage?: number;
};

export type EbayTradingRequest = {
  url: string;
  headers: Record<string, string>;
  body: string;
};

export type EbayBuyingHistoryPage = {
  list: EbayBuyingListKind;
  ack: string;
  pageNumber: number;
  totalPages: number;
  totalEntries: number;
  items: EbayBuyingHistoryItem[];
};

export class EbayTradingApiError extends Error {
  readonly status?: number;
  readonly ack?: string;

  constructor(message: string, details: { status?: number; ack?: string } = {}) {
    super(message);
    this.status = details.status;
    this.ack = details.ack;
  }
}

const TRADING_API_COMPATIBILITY_LEVEL = "1423";

export function buildGetMyeBayBuyingRequest(
  config: EbayConfig,
  accessToken: string,
  input: GetMyeBayBuyingInput
): EbayTradingRequest {
  assertTrustedTradingApiUrl(config);

  const pageNumber = input.pageNumber ?? 1;
  const entriesPerPage = input.entriesPerPage ?? 100;

  return {
    url: config.tradingApiUrl,
    headers: {
      "Content-Type": "text/xml",
      "X-EBAY-API-CALL-NAME": "GetMyeBayBuying",
      "X-EBAY-API-COMPATIBILITY-LEVEL": TRADING_API_COMPATIBILITY_LEVEL,
      "X-EBAY-API-SITEID": config.tradingSiteId,
      "X-EBAY-API-IAF-TOKEN": accessToken
    },
    body: [
      '<?xml version="1.0" encoding="utf-8"?>',
      '<GetMyeBayBuyingRequest xmlns="urn:ebay:apis:eBLBaseComponents">',
      "  <WarningLevel>High</WarningLevel>",
      "  <DetailLevel>ReturnAll</DetailLevel>",
      `  <${input.list}>`,
      "    <Include>true</Include>",
      "    <Pagination>",
      `      <EntriesPerPage>${entriesPerPage}</EntriesPerPage>`,
      `      <PageNumber>${pageNumber}</PageNumber>`,
      "    </Pagination>",
      `  </${input.list}>`,
      "</GetMyeBayBuyingRequest>"
    ].join("\n")
  };
}

export async function fetchGetMyeBayBuyingPage(
  config: EbayConfig,
  accessToken: string,
  input: GetMyeBayBuyingInput,
  options: { fetch?: typeof fetch } = {}
): Promise<EbayBuyingHistoryPage> {
  const fetchImpl = options.fetch ?? fetch;
  const request = buildGetMyeBayBuyingRequest(config, accessToken, input);
  const response = await fetchImpl(request.url, {
    method: "POST",
    headers: request.headers,
    body: request.body
  });

  if (!response.ok) {
    throw new EbayTradingApiError(`eBay Trading API request failed with status ${response.status}`, {
      status: response.status
    });
  }

  return parseGetMyeBayBuyingResponse(await response.text(), input.list);
}

export function parseGetMyeBayBuyingResponse(xml: string, list: EbayBuyingListKind): EbayBuyingHistoryPage {
  const ack = firstText(xml, "Ack");
  if (!ack) {
    throw new EbayTradingApiError("eBay Trading API response was missing Ack");
  }

  if (ack !== "Success" && ack !== "Warning") {
    throw new EbayTradingApiError(`eBay Trading API returned ${ack}`, { ack });
  }

  const listXml = firstBlock(xml, list);
  if (!listXml) {
    throw new EbayTradingApiError(`eBay Trading API response was missing ${list}`);
  }

  return {
    list,
    ack,
    pageNumber: Number(firstText(listXml, "PageNumber") ?? 1),
    totalPages: Number(firstText(listXml, "TotalNumberOfPages") ?? 1),
    totalEntries: Number(firstText(listXml, "TotalNumberOfEntries") ?? 0),
    items: blocks(listXml, "Item").map((itemXml) => parseItem(itemXml, list))
  };
}

function parseItem(xml: string, list: EbayBuyingListKind): EbayBuyingHistoryItem {
  const itemId = firstText(xml, "ItemID");
  const title = firstText(xml, "Title");
  if (!itemId || !title) {
    throw new EbayTradingApiError("eBay Trading API item was missing ItemID or Title");
  }

  return {
    itemId,
    title,
    list,
    currentPrice: parseCurrentPrice(xml),
    endTime: firstText(firstBlock(xml, "ListingDetails") ?? "", "EndTime"),
    sellerUserId: firstText(firstBlock(xml, "Seller") ?? "", "UserID"),
    conditionDisplayName: firstText(xml, "ConditionDisplayName")
  };
}

function parseCurrentPrice(xml: string): EbayMoney | undefined {
  const match = xml.match(/<CurrentPrice(?:\s[^>]*)?>([\s\S]*?)<\/CurrentPrice>/);
  if (!match) {
    return undefined;
  }

  const value = Number(stripTags(match[1]));
  const currency = attributeValue(match[0], "currencyID");
  if (!Number.isFinite(value) || !currency) {
    return undefined;
  }

  return { value, currency };
}

function firstBlock(xml: string, tag: string): string | undefined {
  return blocks(xml, tag)[0];
}

function firstText(xml: string, tag: string): string | undefined {
  const block = firstBlock(xml, tag);
  return block === undefined ? undefined : decodeXml(stripTags(block).trim());
}

function blocks(xml: string, tag: string): string[] {
  return Array.from(xml.matchAll(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "g")), (match) => match[1]);
}

function attributeValue(xml: string, name: string): string | undefined {
  const match = xml.match(new RegExp(`${name}="([^"]+)"`));
  return match?.[1];
}

function stripTags(value: string): string {
  return value.replace(/<[^>]+>/g, "");
}

function decodeXml(value: string): string {
  return value
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");
}

function assertTrustedTradingApiUrl(config: EbayConfig): void {
  const expectedOrigin =
    config.environment === "sandbox" ? "https://api.sandbox.ebay.com" : "https://api.ebay.com";
  const url = new URL(config.tradingApiUrl);

  if (url.origin !== expectedOrigin || url.pathname !== "/ws/api.dll") {
    throw new EbayTradingApiError("eBay Trading API URL is not trusted");
  }
}
