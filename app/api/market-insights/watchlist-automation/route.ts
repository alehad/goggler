import { NextRequest, NextResponse } from "next/server.js";
import { validateSameOriginRequest } from "../../../../src/auth/csrf.ts";
import { getOrCreateCurrentUser } from "../../../../src/auth/current-user.ts";
import { loadEbayConfig } from "../../../../src/ebay/config.ts";
import { parseMatchingPreferences } from "../../../../src/ebay/matching-preferences.ts";
import { requireSessionEbayAccessToken } from "../../../../src/ebay/session-access.ts";
import { discoverAndWatchLiveAuctions, type WatchlistAutomationEvent } from "../../../../src/market-insights/watchlist-automation.ts";

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
    exactTitleMatch: boolean;
    criteriaText: string;
  }>;

  const matchingPreferences = parseMatchingPreferences({
    exactTitleMatch: body.exactTitleMatch,
    criteriaText: body.criteriaText
  });

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      function emit(event: WatchlistAutomationEvent | { type: "error"; error: string }) {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      }

      try {
        const config = loadEbayConfig();
        const result = await discoverAndWatchLiveAuctions(
          config,
          currentUser.context.user.id,
          ebayAccess.accessToken,
          matchingPreferences,
          { onEvent: emit }
        );
        console.info("Watchlist automation result", {
          recordIdsSearched: result.recordIdsSearched,
          candidatesFound: result.candidatesFound,
          alreadyWatched: result.alreadyWatched,
          added: result.added,
          failed: result.failed
        });
      } catch {
        console.warn("Watchlist automation failed", { type: "unexpected_error" });
        emit({ type: "error", error: "watchlist_automation_failed" });
      } finally {
        controller.close();
      }
    }
  });

  const response = new NextResponse(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-store"
    }
  });
  return withInternalSessionCookie(response, currentUser.setCookie);
}

function withInternalSessionCookie(response: NextResponse, setCookie: string | undefined): NextResponse {
  if (setCookie) {
    response.headers.set("Set-Cookie", setCookie);
  }
  return response;
}
