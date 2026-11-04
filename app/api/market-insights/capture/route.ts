import { requireSessionEbayAccessToken } from "../../../../src/ebay/session-access.ts";
import { NextRequest, NextResponse } from "next/server.js";
import { validateSameOriginRequest } from "../../../../src/auth/csrf.ts";
import { getOrCreateCurrentUser } from "../../../../src/auth/current-user.ts";
import { loadEbayConfig } from "../../../../src/ebay/config.ts";
import type { EbayBuyingHistoryItem } from "../../../../src/ebay/trading-client.ts";
import { captureItems } from "../../../../src/market-insights/price-history.ts";
import { getMatchingPreferencesForUser } from "../../../../src/persistence/matching-preferences.ts";

const MAX_CAPTURE_ITEMS = 200;
const MAX_STRING_LENGTH = 500;

export async function POST(request: NextRequest) {
  const csrf = validateSameOriginRequest(request);
  if (!csrf.ok) {
    return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  }

  const currentUser = getOrCreateCurrentUser(request);

  const body = (await request.json().catch(() => ({}))) as Partial<{
    items: unknown;
  }>;

  const items = parseItems(body.items);
  if (items.length === 0) {
    return withInternalSessionCookie(
      NextResponse.json({ error: "items_required" }, { status: 400 }),
      currentUser.setCookie
    );
  }

  const access = requireSessionEbayAccessToken(currentUser.context.session.id);
  if (!access.ok) return withInternalSessionCookie(NextResponse.json({ error: "ebay_reauth_required" }, { status: 409 }), currentUser.setCookie);
  const matchingPreferences = await getMatchingPreferencesForUser(currentUser.context.user.id);

  try {
    const config = loadEbayConfig();
    const result = await captureItems(config, currentUser.context.user.id, items, matchingPreferences, { accessToken: access.accessToken });

    return withInternalSessionCookie(NextResponse.json(result), currentUser.setCookie);
  } catch (error) {
    console.warn("Market insights capture failed", {
      type: "unexpected_error",
      itemCount: items.length,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    return withInternalSessionCookie(
      NextResponse.json({ error: "capture_failed" }, { status: 502 }),
      currentUser.setCookie
    );
  }
}

function parseItems(value: unknown): Pick<EbayBuyingHistoryItem, "itemId">[] {
  if (!Array.isArray(value)) return [];
  const ids = new Set<string>();
  for (const entry of value.slice(0, MAX_CAPTURE_ITEMS)) {
    if (typeof entry !== "object" || entry === null) continue;
    const id = boundedString((entry as Record<string, unknown>).itemId);
    if (id) ids.add(id);
  }
  return [...ids].map(itemId => ({ itemId }));
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
