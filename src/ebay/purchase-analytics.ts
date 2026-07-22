import type { EbayBuyingHistoryItem, EbayMoney } from "./trading-client.ts";

export type PurchaseChartPoint = {
  itemId: string;
  title: string;
  price: EbayMoney;
  timestamp: number;
  date: string;
  won?: boolean;
};

type PricedPurchase = {
  item: EbayBuyingHistoryItem;
  price: EbayMoney;
};

export function buildPurchaseChartPoints(items: EbayBuyingHistoryItem[]): PurchaseChartPoint[] {
  const pricedItems = items.flatMap((item): PricedPurchase[] => {
    const value = item.currentPrice?.value;
    const currency = item.currentPrice?.currency;
    if (!Number.isFinite(value) || value === undefined || value < 0 || !currency) {
      return [];
    }

    return [{ item, price: { value, currency } }];
  });

  return pricedItems
    .flatMap((entry): PurchaseChartPoint[] => {
      const timestamp = entry.item.endTime ? Date.parse(entry.item.endTime) : Number.NaN;
      if (!Number.isFinite(timestamp)) {
        return [];
      }

      return [
        {
          itemId: entry.item.itemId,
          title: entry.item.title,
          price: entry.price,
          timestamp,
          date: entry.item.endTime ?? ""
        }
      ];
    })
    .sort((left, right) => left.timestamp - right.timestamp);
}
