import type { EbayBuyingHistoryItem } from "./trading-client.ts";

export function sameCategory(
  sourceItem: Pick<EbayBuyingHistoryItem, "categoryId" | "categoryName">,
  row: { categoryId?: string; categoryName?: string }
): boolean {
  if (sourceItem.categoryId) {
    return row.categoryId === sourceItem.categoryId;
  }

  if (sourceItem.categoryName) {
    return normalizedCategoryName(row.categoryName) === normalizedCategoryName(sourceItem.categoryName);
  }

  return isRecordCategory(row);
}

export function normalizedCategoryName(value: string | undefined): string | undefined {
  return value?.trim().toLocaleLowerCase("en-GB").replace(/\s+/g, " ");
}

export function isRecordCategory(row: { categoryId?: string; categoryName?: string }): boolean {
  const categoryName = normalizedCategoryName(row.categoryName);
  return Boolean(categoryName && /\b(vinyl|record|records|lp|lps)\b/.test(categoryName));
}
