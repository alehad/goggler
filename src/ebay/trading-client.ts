import type { EbayConfig } from "./config.ts";

export type EbayBuyingListKind = "LostList" | "WatchList" | "WonList";

export type EbayMoney = {
  value: number;
  currency: string;
};

export type EbayBuyingHistoryItem = {
  itemId: string;
  title: string;
  list: EbayBuyingListKind;
  currentPrice?: EbayMoney;
  maxBid?: EbayMoney;
  endTime?: string;
  sellerUserId?: string;
  conditionDisplayName?: string;
  categoryId?: string;
  categoryName?: string;
  imageUrl?: string;
  itemWebUrl?: string;
  relistingGroupId?: string;
};

export type GetMyeBayBuyingInput = {
  list: EbayBuyingListKind;
  pageNumber?: number;
  entriesPerPage?: number;
};

export type GetMyeBayBuyingPagesInput = {
  list: EbayBuyingListKind;
  entriesPerPage?: number;
  maxPages?: number;
};

export type GetOrdersInput = {
  createTimeFrom: Date;
  createTimeTo: Date;
  pageNumber?: number;
  entriesPerPage?: number;
};

export type GetOrdersPagesInput = {
  createTimeFrom: Date;
  createTimeTo: Date;
  entriesPerPage?: number;
  maxPages?: number;
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

export type EbayBuyingHistoryPages = {
  list: EbayBuyingListKind;
  pagesFetched: number;
  truncated: boolean;
  totalPages: number;
  totalEntries: number;
  items: EbayBuyingHistoryItem[];
};

export type EbayBuyerOrdersPage = {
  ack: string;
  pageNumber: number;
  totalPages: number;
  totalEntries: number;
  items: EbayBuyingHistoryItem[];
};

export type EbayBuyerOrdersPages = {
  pagesFetched: number;
  truncated: boolean;
  totalPages: number;
  totalEntries: number;
  items: EbayBuyingHistoryItem[];
};

export class EbayTradingApiError extends Error {
  readonly status?: number;
  readonly ack?: string;
  readonly errorCodes?: string[];

  constructor(message: string, details: { status?: number; ack?: string; errorCodes?: string[] } = {}) {
    super(message);
    this.status = details.status;
    this.ack = details.ack;
    this.errorCodes = details.errorCodes;
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

export function buildGetOrdersRequest(
  config: EbayConfig,
  accessToken: string,
  input: GetOrdersInput
): EbayTradingRequest {
  assertTrustedTradingApiUrl(config);

  const pageNumber = input.pageNumber ?? 1;
  const entriesPerPage = input.entriesPerPage ?? 100;

  return {
    url: config.tradingApiUrl,
    headers: {
      "Content-Type": "text/xml",
      "X-EBAY-API-CALL-NAME": "GetOrders",
      "X-EBAY-API-COMPATIBILITY-LEVEL": TRADING_API_COMPATIBILITY_LEVEL,
      "X-EBAY-API-SITEID": config.tradingSiteId,
      "X-EBAY-API-IAF-TOKEN": accessToken
    },
    body: [
      '<?xml version="1.0" encoding="utf-8"?>',
      '<GetOrdersRequest xmlns="urn:ebay:apis:eBLBaseComponents">',
      "  <WarningLevel>High</WarningLevel>",
      "  <DetailLevel>ReturnAll</DetailLevel>",
      "  <OrderRole>Buyer</OrderRole>",
      "  <OrderStatus>All</OrderStatus>",
      `  <CreateTimeFrom>${input.createTimeFrom.toISOString()}</CreateTimeFrom>`,
      `  <CreateTimeTo>${input.createTimeTo.toISOString()}</CreateTimeTo>`,
      "  <Pagination>",
      `    <EntriesPerPage>${entriesPerPage}</EntriesPerPage>`,
      `    <PageNumber>${pageNumber}</PageNumber>`,
      "  </Pagination>",
      "</GetOrdersRequest>"
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

export async function fetchGetOrdersPage(
  config: EbayConfig,
  accessToken: string,
  input: GetOrdersInput,
  options: { fetch?: typeof fetch } = {}
): Promise<EbayBuyerOrdersPage> {
  const fetchImpl = options.fetch ?? fetch;
  const request = buildGetOrdersRequest(config, accessToken, input);
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

  return parseGetOrdersResponse(await response.text());
}

export async function fetchGetMyeBayBuyingPages(
  config: EbayConfig,
  accessToken: string,
  input: GetMyeBayBuyingPagesInput,
  options: { fetch?: typeof fetch } = {}
): Promise<EbayBuyingHistoryPages> {
  const maxPages = Math.min(Math.max(input.maxPages ?? 3, 1), 10);
  const entriesPerPage = input.entriesPerPage ?? 50;
  const items: EbayBuyingHistoryItem[] = [];
  let pageNumber = 1;
  let totalPages = 1;
  let totalEntries = 0;

  while (pageNumber <= totalPages && pageNumber <= maxPages) {
    const page = await fetchGetMyeBayBuyingPage(
      config,
      accessToken,
      {
        list: input.list,
        entriesPerPage,
        pageNumber
      },
      options
    );

    totalPages = Math.max(1, page.totalPages);
    totalEntries = page.totalEntries;
    items.push(...page.items);
    pageNumber += 1;
  }

  return {
    list: input.list,
    pagesFetched: pageNumber - 1,
    truncated: totalPages > maxPages,
    totalPages,
    totalEntries,
    items
  };
}

export async function fetchGetOrdersPages(
  config: EbayConfig,
  accessToken: string,
  input: GetOrdersPagesInput,
  options: { fetch?: typeof fetch } = {}
): Promise<EbayBuyerOrdersPages> {
  const maxPages = Math.min(Math.max(input.maxPages ?? 3, 1), 10);
  const entriesPerPage = input.entriesPerPage ?? 50;
  const items: EbayBuyingHistoryItem[] = [];
  let pageNumber = 1;
  let totalPages = 1;
  let totalEntries = 0;

  while (pageNumber <= totalPages && pageNumber <= maxPages) {
    const page = await fetchGetOrdersPage(
      config,
      accessToken,
      {
        createTimeFrom: input.createTimeFrom,
        createTimeTo: input.createTimeTo,
        entriesPerPage,
        pageNumber
      },
      options
    );

    totalPages = Math.max(1, page.totalPages);
    totalEntries = page.totalEntries;
    items.push(...page.items);
    pageNumber += 1;
  }

  return {
    pagesFetched: pageNumber - 1,
    truncated: totalPages > maxPages,
    totalPages,
    totalEntries,
    items
  };
}

export function parseGetMyeBayBuyingResponse(xml: string, list: EbayBuyingListKind): EbayBuyingHistoryPage {
  const ack = firstText(xml, "Ack");
  if (!ack) {
    throw new EbayTradingApiError("eBay Trading API response was missing Ack");
  }

  if (ack !== "Success" && ack !== "Warning") {
    throw new EbayTradingApiError(`eBay Trading API returned ${ack}`, { ack, errorCodes: tradingApiErrorCodes(xml) });
  }

  const listXml = firstBlock(xml, list);
  if (!listXml) {
    return {
      list,
      ack,
      pageNumber: 1,
      totalPages: 1,
      totalEntries: 0,
      items: []
    };
  }

  return {
    list,
    ack,
    pageNumber: parsePositiveInteger(firstText(listXml, "PageNumber"), 1),
    totalPages: parsePositiveInteger(firstText(listXml, "TotalNumberOfPages"), 1),
    totalEntries: parsePositiveInteger(firstText(listXml, "TotalNumberOfEntries"), 0),
    items: blocks(listXml, "Item").map((itemXml) => parseItem(itemXml, list))
  };
}

export function parseGetOrdersResponse(xml: string): EbayBuyerOrdersPage {
  const ack = firstText(xml, "Ack");
  if (!ack) {
    throw new EbayTradingApiError("eBay Trading API response was missing Ack");
  }

  if (ack !== "Success" && ack !== "Warning") {
    throw new EbayTradingApiError(`eBay Trading API returned ${ack}`, { ack, errorCodes: tradingApiErrorCodes(xml) });
  }

  const orderArrayXml = firstBlock(xml, "OrderArray") ?? "";

  return {
    ack,
    pageNumber: parsePositiveInteger(firstText(xml, "PageNumber"), 1),
    totalPages: parsePositiveInteger(firstText(xml, "TotalNumberOfPages"), 1),
    totalEntries: parsePositiveInteger(firstText(xml, "TotalNumberOfEntries"), 0),
    items: blocks(orderArrayXml, "Order").flatMap((orderXml) => parseOrderItems(orderXml))
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
    maxBid: list === "LostList" ? parseMoney(xml, "MaxBid") : undefined,
    endTime: firstText(firstBlock(xml, "ListingDetails") ?? "", "EndTime"),
    sellerUserId: firstText(firstBlock(xml, "Seller") ?? "", "UserID"),
    conditionDisplayName: firstText(xml, "ConditionDisplayName"),
    categoryId: firstText(firstBlock(xml, "PrimaryCategory") ?? "", "CategoryID"),
    categoryName: firstText(firstBlock(xml, "PrimaryCategory") ?? "", "CategoryName"),
    imageUrl: parseImageUrl(xml),
    itemWebUrl: parseItemWebUrl(xml)
  };
}

function parseOrderItems(orderXml: string): EbayBuyingHistoryItem[] {
  const orderId = firstText(orderXml, "OrderID");
  const orderCreatedTime = firstText(orderXml, "CreatedTime");
  const paidTime = firstText(orderXml, "PaidTime");
  const orderSellerUserId = firstText(orderXml, "SellerUserID");
  const transactionArrayXml = firstBlock(orderXml, "TransactionArray") ?? "";

  return blocks(transactionArrayXml, "Transaction").flatMap((transactionXml) => {
    const itemXml = firstBlock(transactionXml, "Item") ?? "";
    const transactionId = firstText(transactionXml, "TransactionID");
    const itemId = firstText(itemXml, "ItemID") ?? firstText(transactionXml, "ItemID") ?? orderId ?? transactionId;
    const title = firstText(itemXml, "Title") ?? firstText(transactionXml, "Title");

    if (!itemId || !title) {
      return [];
    }

    return {
      itemId,
      title,
      list: "WonList",
      currentPrice: parseMoney(transactionXml, "TransactionPrice") ?? parseMoney(itemXml, "CurrentPrice"),
      endTime: firstText(transactionXml, "CreatedDate") ?? paidTime ?? orderCreatedTime,
      sellerUserId: firstText(firstBlock(itemXml, "Seller") ?? "", "UserID") ?? orderSellerUserId,
      conditionDisplayName: firstText(itemXml, "ConditionDisplayName"),
      categoryId: firstText(firstBlock(itemXml, "PrimaryCategory") ?? "", "CategoryID"),
      categoryName: firstText(firstBlock(itemXml, "PrimaryCategory") ?? "", "CategoryName"),
      imageUrl: parseImageUrl(transactionXml) ?? parseImageUrl(itemXml),
      itemWebUrl: parseItemWebUrl(transactionXml) ?? parseItemWebUrl(itemXml)
    } satisfies EbayBuyingHistoryItem;
  });
}

function parseImageUrl(xml: string): string | undefined {
  const value = firstText(firstBlock(xml, "PictureDetails") ?? "", "GalleryURL") ?? firstText(xml, "GalleryURL");
  if (!value) {
    return undefined;
  }

  try {
    const url = new URL(value);
    return url.protocol === "https:" && !isLocalOrPrivateHost(url.hostname) ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function parseItemWebUrl(xml: string): string | undefined {
  const value = firstText(firstBlock(xml, "ListingDetails") ?? "", "ViewItemURL");
  if (!value) {
    return undefined;
  }

  try {
    const url = new URL(value);
    const hostname = url.hostname.toLocaleLowerCase("en-GB");
    if (url.protocol !== "https:" || isLocalOrPrivateHost(hostname) || !isTrustedEbayItemHost(hostname)) {
      return undefined;
    }

    url.username = "";
    url.password = "";
    url.hash = "";
    url.search = "";
    return url.toString();
  } catch {
    return undefined;
  }
}

function isTrustedEbayItemHost(hostname: string): boolean {
  return hostname === "ebay.co.uk" || hostname === "www.ebay.co.uk" || hostname === "ebay.com" || hostname === "www.ebay.com";
}

function isLocalOrPrivateHost(hostname: string): boolean {
  const host = hostname.toLocaleLowerCase("en-GB").replace(/^\[(.*)\]$/, "$1");
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.includes(":")
  ) {
    return true;
  }

  const ipv4Host = host.startsWith("::ffff:") ? host.slice("::ffff:".length) : host;
  const parts = ipv4Host.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }

  const [first, second] = parts;
  return (
    first === 10 ||
    first === 127 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  );
}

function parseCurrentPrice(xml: string): EbayMoney | undefined {
  return parseMoney(xml, "CurrentPrice");
}

function parseMoney(xml: string, tag: string): EbayMoney | undefined {
  const escapedTag = escapeRegex(tag);
  const match = xml.match(new RegExp(`<${escapedTag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escapedTag}>`));
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

function tradingApiErrorCodes(xml: string): string[] | undefined {
  const codes = blocks(xml, "Errors")
    .map((errorXml) => firstText(errorXml, "ErrorCode"))
    .filter((value): value is string => Boolean(value));
  return codes.length > 0 ? codes : undefined;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  if (value === undefined) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return fallback;
  }

  return parsed;
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
