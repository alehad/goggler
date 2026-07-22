import { NextRequest, NextResponse } from "next/server.js";
import { getOrCreateCurrentUser } from "../../../../src/auth/current-user.ts";
import { parseMatchingPreferences } from "../../../../src/ebay/matching-preferences.ts";
import { listMatchedSales } from "../../../../src/market-insights/price-history.ts";

export async function GET(request: NextRequest) {
  const currentUser = getOrCreateCurrentUser(request);
  const searchParams = request.nextUrl.searchParams;
  const relistingGroupId = searchParams.get("relistingGroupId");
  const currency = searchParams.get("currency");

  if (!relistingGroupId || !currency) {
    return withInternalSessionCookie(
      NextResponse.json({ error: "relisting_group_and_currency_required" }, { status: 400 }),
      currentUser.setCookie
    );
  }

  const matchingPreferences = parseMatchingPreferences({
    exactTitleMatch: searchParams.get("exactTitleMatch") ?? undefined,
    criteriaText: searchParams.get("criteriaText") ?? undefined
  });

  try {
    const sales = await listMatchedSales(currentUser.context.user.id, relistingGroupId, currency, matchingPreferences);
    return withInternalSessionCookie(NextResponse.json({ sales }), currentUser.setCookie);
  } catch {
    console.warn("Market insights matched-sales lookup failed", { type: "unexpected_error" });
    return withInternalSessionCookie(
      NextResponse.json({ error: "matched_sales_unavailable" }, { status: 502 }),
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
