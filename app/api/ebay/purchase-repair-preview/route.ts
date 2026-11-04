import { NextRequest, NextResponse } from "next/server.js";
import { getCurrentUser } from "../../../../src/auth/current-user.ts";
import { validateSameOriginRequest } from "../../../../src/auth/csrf.ts";
import { loadEbayConfig } from "../../../../src/ebay/config.ts";
import { requireSessionEbayAccessToken } from "../../../../src/ebay/session-access.ts";
import { fetchLiveEbayHistoryResponse } from "../../../../src/ebay/live-history-source.ts";
import { buildPurchaseRepairPlan } from "../../../../src/ebay/purchase-repair-plan.ts";
import { listAllWonItems } from "../../../../src/persistence/won-items.ts";
import { getMatchingPreferencesForUser } from "../../../../src/persistence/matching-preferences.ts";

/** Read-only review gate. Never call persistence/import functions here. */
export async function POST(request: NextRequest) {
  if (!validateSameOriginRequest(request).ok) return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  const current = getCurrentUser(request);
  if (!current) return NextResponse.json({ error: "local_auth_required" }, { status: 401 });
  const access = requireSessionEbayAccessToken(current.session.id);
  if (!access.ok) return NextResponse.json({ error: "ebay_reauth_required" }, { status: 409 });
  try {
    const preferences = await getMatchingPreferencesForUser(current.user.id);
    const [stored, live] = await Promise.all([
      listAllWonItems(current.user.id),
      fetchLiveEbayHistoryResponse(loadEbayConfig(), access.accessToken, { discoverRelistings: false, matchingPreferences: preferences })
    ]);
    return NextResponse.json({ readOnly: true, generatedAt: new Date().toISOString(),
      rows: buildPurchaseRepairPlan(stored, live.wonItems), warnings: live.warnings ?? [] }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "purchase_preview_unavailable" }, { status: 502 });
  }
}
