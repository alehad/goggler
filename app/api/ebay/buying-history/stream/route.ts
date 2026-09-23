import { NextRequest } from "next/server.js";
import { validateSameOriginRequest } from "../../../../../src/auth/csrf.ts";
import { getOrCreateCurrentUser } from "../../../../../src/auth/current-user.ts";
import { loadEbayConfig } from "../../../../../src/ebay/config.ts";
import { getFixtureHistoryResponse } from "../../../../../src/ebay/fixture-history-source.ts";
import { getEbayHistorySourceStatus } from "../../../../../src/ebay/history-source.ts";
import type { BuyingHistoryStreamEvent } from "../../../../../src/ebay/history-stream.ts";
import { fetchLiveEbayHistoryResponse, refreshLiveHistoryDerivedData } from "../../../../../src/ebay/live-history-source.ts";
import { parseMatchingPreferences } from "../../../../../src/ebay/matching-preferences.ts";
import { requireSessionEbayAccessToken } from "../../../../../src/ebay/session-access.ts";
import type { EbayHistoryResponse } from "../../../../../src/ebay/history-response.ts";
import { listCaptureCandidates } from "../../../../../src/market-insights/price-history.ts";
import { persistLostItemsAndMerge } from "../../../../../src/persistence/lost-items.ts";
import { persistWonItemsAndMerge } from "../../../../../src/persistence/won-items.ts";

export async function POST(request: NextRequest) {
  const csrf = validateSameOriginRequest(request);
  if (!csrf.ok) {
    return jsonError({ error: "invalid_origin" }, 403);
  }

  const currentUser = getOrCreateCurrentUser(request);

  const sourceStatus = getEbayHistorySourceStatus();
  if (!sourceStatus.ok) {
    return jsonError({ error: sourceStatus.error }, 503, currentUser.setCookie);
  }

  const ebayAccess = requireSessionEbayAccessToken(currentUser.context.session.id);
  if (!ebayAccess.ok) {
    return jsonError({ error: "ebay_reauth_required" }, 409, currentUser.setCookie);
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
      const send = (event: BuyingHistoryStreamEvent) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };

      try {
        if (sourceStatus.source !== "live") {
          send({ type: "complete", history: await withCaptureStatus(getFixtureHistoryResponse(), currentUser.context.user.id) });
          return;
        }

        const config = loadEbayConfig();
        const liveHistory = await fetchLiveEbayHistoryResponse(config, ebayAccess.accessToken, {
          discoverRelistings: false,
          matchingPreferences,
          onEvent: send
        });
        const withPersistedWonItems = await persistWonItemsAndMerge(liveHistory, currentUser.context.user.id, matchingPreferences);
        const withPersistedHistory = await persistLostItemsAndMerge(withPersistedWonItems, currentUser.context.user.id, matchingPreferences);
        const history = await refreshLiveHistoryDerivedData(config, withPersistedHistory, matchingPreferences, {}, send);
        if (history.diagnostics?.purchases) {
          console.info("Live eBay purchase source diagnostics", history.diagnostics.purchases);
        }

        send({ type: "complete", history: await withCaptureStatus(history, currentUser.context.user.id) });
      } catch (error) {
        console.warn("Streamed live eBay history fetch failed", {
          type: "unexpected_error",
          message: error instanceof Error ? error.message : String(error)
        });
        send({ type: "error", error: "live_history_error" });
      } finally {
        controller.close();
      }
    }
  });

  const headers = new Headers({ "Content-Type": "application/x-ndjson; charset=utf-8" });
  if (currentUser.setCookie) {
    headers.set("Set-Cookie", currentUser.setCookie);
  }

  return new Response(stream, { headers });
}

async function withCaptureStatus(history: EbayHistoryResponse, userId: string) {
  return {
    ...history,
    endedWatchlistItems: await listCaptureCandidates(history, userId)
  };
}

function jsonError(body: Record<string, unknown>, status: number, setCookie?: string) {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (setCookie) {
    headers.set("Set-Cookie", setCookie);
  }
  return new Response(JSON.stringify(body), { status, headers });
}
