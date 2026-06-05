import { NextRequest, NextResponse } from "next/server.js";
import { validateSameOriginRequest } from "../../../../src/auth/csrf.ts";
import { getOrCreateCurrentUser } from "../../../../src/auth/current-user.ts";
import { loadEbayConfig } from "../../../../src/ebay/config.ts";
import { getFixtureHistoryResponse } from "../../../../src/ebay/fixture-history-source.ts";
import { getEbayHistorySourceStatus } from "../../../../src/ebay/history-source.ts";
import { fetchLiveEbayHistoryResponse } from "../../../../src/ebay/live-history-source.ts";
import { parseMatchingPreferences } from "../../../../src/ebay/matching-preferences.ts";
import { requireSessionEbayAccessToken } from "../../../../src/ebay/session-access.ts";
import { EbayTradingApiError } from "../../../../src/ebay/trading-client.ts";

export async function GET(request: NextRequest) {
  return handleBuyingHistoryRequest(request, parseMatchingPreferences({}));
}

export async function POST(request: NextRequest) {
  const csrf = validateSameOriginRequest(request);
  if (!csrf.ok) {
    return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as Partial<{
    exactTitleMatch: boolean;
    criteriaText: string;
  }>;

  return handleBuyingHistoryRequest(
    request,
    parseMatchingPreferences({
      exactTitleMatch: body.exactTitleMatch,
      criteriaText: body.criteriaText
    })
  );
}

async function handleBuyingHistoryRequest(request: NextRequest, matchingPreferences = parseMatchingPreferences({})) {
  const currentUser = getOrCreateCurrentUser(request);

  const sourceStatus = getEbayHistorySourceStatus();
  if (!sourceStatus.ok) {
    return withInternalSessionCookie(
      NextResponse.json({ error: sourceStatus.error }, { status: 503 }),
      currentUser.setCookie
    );
  }

  const ebayAccess = requireSessionEbayAccessToken(currentUser.context.session.id);
  if (!ebayAccess.ok) {
    return withInternalSessionCookie(
      NextResponse.json({ error: "ebay_reauth_required" }, { status: 409 }),
      currentUser.setCookie
    );
  }

  if (sourceStatus.source === "live") {
    try {
      const history = await fetchLiveEbayHistoryResponse(loadEbayConfig(), ebayAccess.accessToken, {
        matchingPreferences
      });
      if (history.diagnostics?.purchases) {
        console.info("Live eBay purchase source diagnostics", history.diagnostics.purchases);
      }

      return withInternalSessionCookie(
        NextResponse.json(history),
        currentUser.setCookie
      );
    } catch (error) {
      if (error instanceof EbayTradingApiError) {
        console.warn("Live eBay history fetch failed", {
          type: "trading_api_error",
          hasAck: error.ack !== undefined,
          hasStatus: error.status !== undefined
        });
        return withInternalSessionCookie(
          NextResponse.json({ error: "live_history_error" }, { status: 502 }),
          currentUser.setCookie
        );
      }

      console.warn("Live eBay history fetch failed", {
        type: "unexpected_error"
      });
      return withInternalSessionCookie(
        NextResponse.json({ error: "live_history_error" }, { status: 502 }),
        currentUser.setCookie
      );
    }
  }

  return withInternalSessionCookie(NextResponse.json(getFixtureHistoryResponse()), currentUser.setCookie);
}

function withInternalSessionCookie(response: NextResponse, setCookie: string | undefined): NextResponse {
  if (setCookie) {
    response.headers.set("Set-Cookie", setCookie);
  }
  return response;
}
