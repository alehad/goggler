import type { EbayBuyingHistoryItem, EbayMoney } from "./trading-client.ts";

export type PurchaseStats = {
  average?: EbayMoney;
  lowest?: EbayMoney;
  highest?: EbayMoney;
  count: number;
};

export type PurchaseChartPoint = {
  itemId: string;
  title: string;
  price: EbayMoney;
  timestamp: number;
  date: string;
};

export type PurchaseAnalytics = {
  stats: PurchaseStats;
  chartPoints: PurchaseChartPoint[];
};

type PricedPurchase = {
  item: EbayBuyingHistoryItem;
  price: EbayMoney;
};

export function buildPurchaseAnalytics(items: EbayBuyingHistoryItem[]): PurchaseAnalytics {
  const pricedItems = items.flatMap((item): PricedPurchase[] => {
    const value = item.currentPrice?.value;
    const currency = item.currentPrice?.currency;
    if (!Number.isFinite(value) || value === undefined || value < 0 || !currency) {
      return [];
    }

    return [{ item, price: { value, currency } }];
  });

  return {
    stats: buildPurchaseStats(pricedItems),
    chartPoints: buildPurchaseChartPoints(pricedItems)
  };
}

function buildPurchaseStats(items: PricedPurchase[]): PurchaseStats {
  if (items.length === 0) {
    return { count: 0 };
  }

  const sorted = [...items].sort((left, right) => left.price.value - right.price.value);
  const total = sorted.reduce((sum, item) => sum + item.price.value, 0);
  const currency = sorted[0].price.currency;

  return {
    average: { value: total / sorted.length, currency },
    lowest: sorted[0].price,
    highest: sorted[sorted.length - 1].price,
    count: sorted.length
  };
}

function buildPurchaseChartPoints(items: PricedPurchase[]): PurchaseChartPoint[] {
  return items
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
