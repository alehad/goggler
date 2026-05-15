import { NextRequest, NextResponse } from "next/server.js";
import { getOrCreateCurrentUser } from "../../../../src/auth/current-user.ts";
import { loadEbayConfig } from "../../../../src/ebay/config.ts";
import { getFixtureHistoryResponse } from "../../../../src/ebay/fixture-history-source.ts";
import { getEbayHistorySourceStatus } from "../../../../src/ebay/history-source.ts";
import { fetchLiveEbayHistoryResponse } from "../../../../src/ebay/live-history-source.ts";
import { requireSessionEbayAccessToken } from "../../../../src/ebay/session-access.ts";
import { EbayTradingApiError } from "../../../../src/ebay/trading-client.ts";

export async function GET(request: NextRequest) {
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
      return withInternalSessionCookie(
        NextResponse.json(await fetchLiveEbayHistoryResponse(loadEbayConfig(), ebayAccess.accessToken)),
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
