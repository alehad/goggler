import type { EbayBuyingHistoryItem, EbayMoney } from "./trading-client.ts";

export type PurchaseRepairRow = {
  itemId: string; title: string; currentPrice?: EbayMoney; proposedPrice?: EbayMoney;
  currentPurchasedAt?: string; proposedPurchasedAt?: string;
  status: "proposed" | "unresolved"; reason: string;
};

/** Pure dry run: only transaction evidence can propose a paid-price correction.
 * No watched price, product-title match or current asking price is paid evidence.
 */
export function buildPurchaseRepairPlan(stored: readonly EbayBuyingHistoryItem[], live: readonly EbayBuyingHistoryItem[]): PurchaseRepairRow[] {
  const evidence = new Map(live.map(item => [item.itemId, item]));
  return stored.flatMap((item): PurchaseRepairRow[] => {
    const fact = evidence.get(item.itemId);
    if (fact?.purchasePriceConflict) return [{ itemId: item.itemId, title: item.title, currentPrice: item.currentPrice,
      status: "unresolved", reason: "Transaction sources disagree; preserve stored value pending review" }];
    const next = fact?.purchasePriceSource === "transaction" ? fact.currentPrice : undefined;
    if (next && Number.isFinite(next.value) && next.value >= 0 && next.currency) {
      const validLiveDate = fact?.endTime && Number.isFinite(Date.parse(fact.endTime)) ? fact.endTime : undefined;
      const changedDate = validLiveDate && Date.parse(validLiveDate) !== Date.parse(item.endTime ?? "");
      if (next.value === item.currentPrice?.value && next.currency === item.currentPrice?.currency && !changedDate) return [];
      return [{ itemId: item.itemId, title: item.title, currentPrice: item.currentPrice, proposedPrice: next,
        currentPurchasedAt: item.endTime, proposedPurchasedAt: changedDate ? validLiveDate : undefined,
        status: "proposed", reason: "Transaction facts from the same eBay listing" }];
    }
    if (item.currentPrice && item.currentPrice.value > 0) return [];
    return [{ itemId: item.itemId, title: item.title, currentPrice: item.currentPrice,
      status: "unresolved", reason: "No authoritative live transaction price; do not substitute watched price or erase existing value" }];
  });
}
