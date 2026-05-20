import { NextRequest, NextResponse } from "next/server.js";
import { validateSameOriginRequest } from "../../../../src/auth/csrf.ts";
import { getOrCreateCurrentUser } from "../../../../src/auth/current-user.ts";
import { loadEbayConfig } from "../../../../src/ebay/config.ts";
import {
  boundedMarketQuery,
  fetchEbayMarketHistory,
  EbayMarketplaceInsightsError
} from "../../../../src/ebay/marketplace-insights-client.ts";
import { catalogueIdForTitle, parseMatchingPreferences } from "../../../../src/ebay/matching-preferences.ts";
import { getEbayApplicationAccessToken, EbayOAuthError } from "../../../../src/ebay/oauth-client.ts";
import { requireSessionEbayAccessToken } from "../../../../src/ebay/session-access.ts";

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
    title: string;
    criteriaText: string;
    exactTitleMatch: boolean;
  }>;
  const title = typeof body.title === "string" ? body.title : "";
  const queryDetails = marketHistoryQueryForTitle(title, body);
  const query = boundedMarketQuery(queryDetails.query);
  if (!query) {
    return withInternalSessionCookie(
      NextResponse.json({ error: "market_history_query_required" }, { status: 400 }),
      currentUser.setCookie
    );
  }

  try {
    const config = loadEbayConfig();
    const appToken = await getEbayApplicationAccessToken(config);
    return withInternalSessionCookie(
      NextResponse.json({
        status: "ready",
        history: {
          ...(await fetchEbayMarketHistory(config, appToken.accessToken, query)),
          querySource: queryDetails.source
        }
      }),
      currentUser.setCookie
    );
  } catch (error) {
    if (error instanceof EbayOAuthError || error instanceof EbayMarketplaceInsightsError) {
      console.warn("eBay market history unavailable", {
        type: error instanceof EbayOAuthError ? "oauth_error" : "marketplace_insights_error",
        hasStatus: error.status !== undefined
      });

      return withInternalSessionCookie(
        NextResponse.json({ error: "market_history_unavailable", query, querySource: queryDetails.source }, { status: 502 }),
        currentUser.setCookie
      );
    }

    console.warn("eBay market history unavailable", { type: "unexpected_error" });
    return withInternalSessionCookie(
      NextResponse.json({ error: "market_history_unavailable", query, querySource: queryDetails.source }, { status: 502 }),
      currentUser.setCookie
    );
  }
}

function marketHistoryQueryForTitle(
  title: string,
  input: { exactTitleMatch?: string | boolean | null; criteriaText?: string | null }
): { query: string; source: "catalogue_id" | "title" } {
  const preferences = parseMatchingPreferences(input);
  const catalogueId = catalogueIdForTitle(title, preferences.criteriaText);
  return catalogueId ? { query: catalogueId, source: "catalogue_id" } : { query: title, source: "title" };
}

function withInternalSessionCookie(response: NextResponse, setCookie: string | undefined): NextResponse {
  if (setCookie) {
    response.headers.set("Set-Cookie", setCookie);
  }
  return response;
}
