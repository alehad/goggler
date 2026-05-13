import { NextRequest, NextResponse } from "next/server.js";
import { getCurrentUser } from "../../../../src/auth/current-user.ts";
import { loadEbayConfig } from "../../../../src/ebay/config.ts";
import { getFixtureHistoryResponse } from "../../../../src/ebay/fixture-history-source.ts";
import { getEbayHistorySourceStatus } from "../../../../src/ebay/history-source.ts";
import { fetchLiveEbayHistoryResponse } from "../../../../src/ebay/live-history-source.ts";
import { requireSessionEbayAccessToken } from "../../../../src/ebay/session-access.ts";
import { EbayTradingApiError } from "../../../../src/ebay/trading-client.ts";

export async function GET(request: NextRequest) {
  const currentUser = getCurrentUser(request);
  if (!currentUser) {
    return NextResponse.json({ error: "local_auth_required" }, { status: 401 });
  }

  const sourceStatus = getEbayHistorySourceStatus();
  if (!sourceStatus.ok) {
    return NextResponse.json({ error: sourceStatus.error }, { status: 503 });
  }

  const ebayAccess = requireSessionEbayAccessToken(currentUser.session.id);
  if (!ebayAccess.ok) {
    return NextResponse.json({ error: "ebay_reauth_required" }, { status: 409 });
  }

  if (sourceStatus.source === "live") {
    try {
      return NextResponse.json(await fetchLiveEbayHistoryResponse(loadEbayConfig(), ebayAccess.accessToken));
    } catch (error) {
      if (error instanceof EbayTradingApiError) {
        console.warn("Live eBay history fetch failed", {
          type: "trading_api_error",
          hasAck: error.ack !== undefined,
          hasStatus: error.status !== undefined
        });
        return NextResponse.json({ error: "live_history_error" }, { status: 502 });
      }

      console.warn("Live eBay history fetch failed", {
        type: "unexpected_error"
      });
      return NextResponse.json({ error: "live_history_error" }, { status: 502 });
    }
  }

  return NextResponse.json(getFixtureHistoryResponse());
}
