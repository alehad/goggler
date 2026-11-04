import { assembleListings } from "../ebay/listing-assembly.ts";
import { catalogueIdForTitle, relistingGroupForTitle, type MatchingPreferences } from "../ebay/matching-preferences.ts";
import type { EbayBuyingHistoryItem } from "../ebay/trading-client.ts";
import { listAllWonItems } from "../persistence/won-items.ts";
import { listAllLostItems } from "../persistence/lost-items.ts";
import { listAllMarketPriceRecords } from "../persistence/market-price-records.ts";

export type AnalyticsHistoryItem = EbayBuyingHistoryItem & { captured: boolean; won: boolean; eventuallyWon: boolean };

export function assembleAnalyticsHistory(observations: readonly EbayBuyingHistoryItem[], capturedIds: ReadonlySet<string>, preferences: MatchingPreferences): AnalyticsHistoryItem[] {
  const items = assembleListings(observations).map(item => {
    const catalogueId = catalogueIdForTitle(item.title, preferences.criteriaText);
    return { ...item, relistingGroupId: catalogueId ? `criteria:${catalogueId}` : relistingGroupForTitle(item.title, preferences) };
  });
  const wonGroups = new Set(items.filter(item => item.list === "WonList").map(item => item.relistingGroupId).filter(Boolean));
  return items.map(item => ({ ...item, captured: capturedIds.has(item.itemId), won: item.list === "WonList",
    eventuallyWon: item.list !== "WonList" && !!item.relistingGroupId && wonGroups.has(item.relistingGroupId)
  })).sort((a, b) => (Date.parse(b.endTime ?? "") || 0) - (Date.parse(a.endTime ?? "") || 0));
}

/** All source facts assembled once, then matching and derived flags. No writes. */
export async function listAssembledStoredHistory(userId: string, preferences: MatchingPreferences): Promise<AnalyticsHistoryItem[]> {
  const [won, lost, captured] = await Promise.all([listAllWonItems(userId), listAllLostItems(userId), listAllMarketPriceRecords(userId)]);
  return assembleAnalyticsHistory([...won, ...lost, ...captured], new Set(captured.map(item => item.itemId)), preferences);
}
