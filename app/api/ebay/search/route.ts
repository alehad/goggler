import { NextRequest, NextResponse } from "next/server.js";
import { validateSameOriginRequest } from "../../../../src/auth/csrf.ts";
import { getOrCreateCurrentUser } from "../../../../src/auth/current-user.ts";
import { fetchEbayBrowseSearchResponse, EbayBrowseApiError, boundedBrowseQuery } from "../../../../src/ebay/browse-client.ts";
import { loadEbayConfig } from "../../../../src/ebay/config.ts";
import { parseMatchingPreferences } from "../../../../src/ebay/matching-preferences.ts";
import { EBAY_BROWSE_SCOPE, EbayOAuthError, getEbayApplicationAccessToken } from "../../../../src/ebay/oauth-client.ts";
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
    query: string;
    exactTitleMatch: boolean;
    criteriaText: string;
  }>;
  const query = boundedBrowseQuery(typeof body.query === "string" ? body.query : "");
  if (!query) {
    return withInternalSessionCookie(
      NextResponse.json({ error: "search_query_required" }, { status: 400 }),
      currentUser.setCookie
    );
  }

  try {
    const config = loadEbayConfig();
    const appToken = await getEbayApplicationAccessToken(config, { scope: EBAY_BROWSE_SCOPE });
    return withInternalSessionCookie(
      NextResponse.json(
        await fetchEbayBrowseSearchResponse(config, appToken.accessToken, query, {
          matchingPreferences: parseMatchingPreferences({
            exactTitleMatch: body.exactTitleMatch,
            criteriaText: body.criteriaText
          })
        })
      ),
      currentUser.setCookie
    );
  } catch (error) {
    if (error instanceof EbayOAuthError || error instanceof EbayBrowseApiError) {
      console.warn("Live eBay search unavailable", {
        type: error instanceof EbayOAuthError ? "oauth_error" : "browse_api_error",
        hasStatus: error.status !== undefined
      });
      return withInternalSessionCookie(
        NextResponse.json({ error: "live_search_unavailable" }, { status: 502 }),
        currentUser.setCookie
      );
    }

    console.warn("Live eBay search unavailable", { type: "unexpected_error" });
    return withInternalSessionCookie(
      NextResponse.json({ error: "live_search_unavailable" }, { status: 502 }),
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
