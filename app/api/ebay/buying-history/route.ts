import { NextRequest, NextResponse } from "next/server.js";
import { getCurrentUser } from "../../../../src/auth/current-user.ts";
import {
  filterLostItemsEventuallyWon,
  filterLostItemsNeverWon,
  mockLostBidItems,
  mockWonItems
} from "../../../../src/ebay/buying-history-fixtures.ts";
import { getEbayHistorySourceStatus } from "../../../../src/ebay/history-source.ts";
import { requireSessionEbayAccessToken } from "../../../../src/ebay/session-access.ts";

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
    return NextResponse.json({ error: "live_history_not_implemented", source: "live" }, { status: 501 });
  }

  const eventuallyWonLostItems = filterLostItemsEventuallyWon(mockLostBidItems, mockWonItems);
  const neverWonLostItems = filterLostItemsNeverWon(mockLostBidItems, mockWonItems);

  return NextResponse.json({
    source: "fixture",
    counts: {
      lost: mockLostBidItems.length,
      won: mockWonItems.length,
      eventuallyWon: eventuallyWonLostItems.length,
      neverWon: neverWonLostItems.length
    },
    lostItems: mockLostBidItems,
    wonItems: mockWonItems
  });
}
