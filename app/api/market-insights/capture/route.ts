import { NextRequest, NextResponse } from "next/server.js";
import { validateSameOriginRequest } from "../../../../src/auth/csrf.ts";
import { getOrCreateCurrentUser } from "../../../../src/auth/current-user.ts";
import { loadEbayConfig } from "../../../../src/ebay/config.ts";
import { parseMatchingPreferences } from "../../../../src/ebay/matching-preferences.ts";
import type { EbayBuyingHistoryItem, EbayBuyingListKind } from "../../../../src/ebay/trading-client.ts";
import { captureItems } from "../../../../src/market-insights/price-history.ts";

const MAX_CAPTURE_ITEMS = 200;
const MAX_STRING_LENGTH = 500;
const BUYING_LIST_KINDS: readonly EbayBuyingListKind[] = ["LostList", "WatchList", "WonList"];

export async function POST(request: NextRequest) {
  const csrf = validateSameOriginRequest(request);
  if (!csrf.ok) {
    return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  }

  const currentUser = getOrCreateCurrentUser(request);

  const body = (await request.json().catch(() => ({}))) as Partial<{
    items: unknown;
    exactTitleMatch: boolean;
    criteriaText: string;
  }>;

  const items = parseItems(body.items);
  if (items.length === 0) {
    return withInternalSessionCookie(
      NextResponse.json({ error: "items_required" }, { status: 400 }),
      currentUser.setCookie
    );
  }

  const matchingPreferences = parseMatchingPreferences({
    exactTitleMatch: body.exactTitleMatch,
    criteriaText: body.criteriaText
  });

  try {
    const config = loadEbayConfig();
    const result = await captureItems(config, currentUser.context.user.id, items, matchingPreferences);

    return withInternalSessionCookie(NextResponse.json(result), currentUser.setCookie);
  } catch {
    console.warn("Market insights capture failed", { type: "unexpected_error" });
    return withInternalSessionCookie(
      NextResponse.json({ error: "capture_failed" }, { status: 502 }),
      currentUser.setCookie
    );
  }
}

function parseItems(value: unknown): EbayBuyingHistoryItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const items: EbayBuyingHistoryItem[] = [];
  for (const entry of value.slice(0, MAX_CAPTURE_ITEMS)) {
    const item = parseItem(entry);
    if (item) {
      items.push(item);
    }
  }
  return items;
}

function parseItem(value: unknown): EbayBuyingHistoryItem | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  const raw = value as Record<string, unknown>;
  const itemId = boundedString(raw.itemId);
  const title = boundedString(raw.title);
  const list = typeof raw.list === "string" && BUYING_LIST_KINDS.includes(raw.list as EbayBuyingListKind) ? (raw.list as EbayBuyingListKind) : undefined;

  if (!itemId || !title || !list) {
    return undefined;
  }

  return {
    itemId,
    title,
    list,
    endTime: boundedString(raw.endTime),
    sellerUserId: boundedString(raw.sellerUserId),
    conditionDisplayName: boundedString(raw.conditionDisplayName),
    imageUrl: boundedString(raw.imageUrl),
    itemWebUrl: boundedString(raw.itemWebUrl)
  };
}

function boundedString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim().slice(0, MAX_STRING_LENGTH);
  return trimmed.length > 0 ? trimmed : undefined;
}

function withInternalSessionCookie(response: NextResponse, setCookie: string | undefined): NextResponse {
  if (setCookie) {
    response.headers.set("Set-Cookie", setCookie);
  }
  return response;
}
