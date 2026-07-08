import { NextRequest, NextResponse } from "next/server.js";
import { validateSameOriginRequest } from "../../../../src/auth/csrf.ts";
import { getOrCreateCurrentUser } from "../../../../src/auth/current-user.ts";
import { loadEbayConfig } from "../../../../src/ebay/config.ts";
import { parseMatchingPreferences } from "../../../../src/ebay/matching-preferences.ts";
import { requireSessionEbayAccessToken } from "../../../../src/ebay/session-access.ts";
import { captureItems } from "../../../../src/market-insights/price-history.ts";

const MAX_CAPTURE_ITEM_IDS = 200;

export async function POST(request: NextRequest) {
  const csrf = validateSameOriginRequest(request);
  if (!csrf.ok) {
    return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  }

  const currentUser = getOrCreateCurrentUser(request);
  const ebayAccess = requireSessionEbayAccessToken(currentUser.context.session.id);
  if (!ebayAccess.ok) {
    return withInternalSessionCookie(
      NextResponse.json({ error: "ebay_reauth_required" }, { status: 409 }),
      currentUser.setCookie
    );
  }

  const body = (await request.json().catch(() => ({}))) as Partial<{
    venueItemIds: unknown;
    exactTitleMatch: boolean;
    criteriaText: string;
  }>;
  const venueItemIds = Array.isArray(body.venueItemIds)
    ? body.venueItemIds.filter((value): value is string => typeof value === "string").slice(0, MAX_CAPTURE_ITEM_IDS)
    : [];

  if (venueItemIds.length === 0) {
    return withInternalSessionCookie(
      NextResponse.json({ error: "venue_item_ids_required" }, { status: 400 }),
      currentUser.setCookie
    );
  }

  const matchingPreferences = parseMatchingPreferences({
    exactTitleMatch: body.exactTitleMatch,
    criteriaText: body.criteriaText
  });

  try {
    const config = loadEbayConfig();
    const result = await captureItems(
      config,
      ebayAccess.accessToken,
      currentUser.context.user.id,
      venueItemIds,
      matchingPreferences
    );

    return withInternalSessionCookie(NextResponse.json(result), currentUser.setCookie);
  } catch {
    console.warn("Market insights capture failed", { type: "unexpected_error" });
    return withInternalSessionCookie(
      NextResponse.json({ error: "capture_failed" }, { status: 502 }),
      currentUser.setCookie
    );
  }
}

function withInternalSessionCookie(response: NextResponse, setCookie: string | undefined): NextResponse {
  if (setCookie) {
    response.headers.set("Set-Cookie", setCookie);
  }
  return response;
}
