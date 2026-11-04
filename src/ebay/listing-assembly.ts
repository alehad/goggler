import type { EbayBuyingHistoryItem } from "./trading-client.ts";

const authority = { WonList: 0, LostList: 1, WatchList: 2 } as const;
const displayFields = ["sellerUserId", "conditionDisplayName", "categoryId", "categoryName", "imageUrl", "itemWebUrl"] as const;

/** Reconcile listing identity BEFORE product matching or price/currency filtering.
 * Lower-authority observations may fill display metadata, never financial facts.
 * Input records and raw persistence observations remain unchanged.
 */
export function assembleListings(observations: readonly EbayBuyingHistoryItem[]): EbayBuyingHistoryItem[] {
  const byId = new Map<string, EbayBuyingHistoryItem>();
  for (const observation of [...observations].sort((a, b) => authority[a.list] - authority[b.list])) {
    const existing = byId.get(observation.itemId);
    if (!existing) {
      byId.set(observation.itemId, { ...observation });
      continue;
    }
    for (const field of displayFields) {
      if (!existing[field] && observation[field]) existing[field] = observation[field];
    }
  }
  return [...byId.values()];
}
