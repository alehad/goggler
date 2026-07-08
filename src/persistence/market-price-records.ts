import { catalogueIdForTitle, relistingGroupForTitle, type MatchingPreferences } from "../ebay/matching-preferences.ts";
import type { EbayBuyingHistoryItem } from "../ebay/trading-client.ts";
import type { PrismaClient } from "../generated/prisma/client.ts";
import { getPrismaClient } from "./prisma.ts";

export async function captureMarketPriceRecords(
  items: EbayBuyingHistoryItem[],
  userId: string,
  matchingPreferences: MatchingPreferences,
  prisma: PrismaClient | undefined = getPrismaClient()
): Promise<{ captured: string[] }> {
  if (!prisma || items.length === 0) {
    return { captured: [] };
  }

  const now = new Date();
  await prisma.$transaction(
    items.map((item) =>
      prisma.marketPriceRecord.upsert({
        create: toMarketPriceRecordCreate(item, userId, matchingPreferences, now),
        update: toMarketPriceRecordUpdate(item, matchingPreferences),
        where: {
          userId_venue_venueItemId: {
            userId,
            venue: "ebay",
            venueItemId: item.itemId
          }
        }
      })
    )
  );

  return { captured: items.map((item) => item.itemId) };
}

export async function listCapturedVenueItemIds(
  userId: string,
  venueItemIds: string[],
  prisma: PrismaClient | undefined = getPrismaClient()
): Promise<Set<string>> {
  if (!prisma || venueItemIds.length === 0) {
    return new Set();
  }

  const existing = await prisma.marketPriceRecord.findMany({
    select: { venueItemId: true },
    where: {
      userId,
      venue: "ebay",
      venueItemId: { in: venueItemIds }
    }
  });

  return new Set(existing.map((record) => record.venueItemId));
}

function toMarketPriceRecordCreate(
  item: EbayBuyingHistoryItem,
  userId: string,
  matchingPreferences: MatchingPreferences,
  now: Date
) {
  return {
    userId,
    venue: "ebay" as const,
    venueItemId: item.itemId,
    title: item.title,
    soldPriceAmount: item.currentPrice?.value,
    soldPriceCurrency: item.currentPrice?.currency,
    endedAt: parseDate(item.endTime),
    sellerUserId: item.sellerUserId,
    conditionDisplayName: item.conditionDisplayName,
    categoryId: item.categoryId,
    categoryName: item.categoryName,
    imageUrl: item.imageUrl,
    itemWebUrl: item.itemWebUrl,
    relistingGroupId: groupForHistoryTitle(item.title, matchingPreferences),
    capturedAt: now
  };
}

function toMarketPriceRecordUpdate(item: EbayBuyingHistoryItem, matchingPreferences: MatchingPreferences) {
  const endedAt = parseDate(item.endTime);
  return {
    title: item.title,
    ...(item.currentPrice ? { soldPriceAmount: item.currentPrice.value, soldPriceCurrency: item.currentPrice.currency } : {}),
    ...(endedAt ? { endedAt } : {}),
    ...(item.sellerUserId ? { sellerUserId: item.sellerUserId } : {}),
    ...(item.conditionDisplayName ? { conditionDisplayName: item.conditionDisplayName } : {}),
    ...(item.categoryId ? { categoryId: item.categoryId } : {}),
    ...(item.categoryName ? { categoryName: item.categoryName } : {}),
    ...(item.imageUrl ? { imageUrl: item.imageUrl } : {}),
    ...(item.itemWebUrl ? { itemWebUrl: item.itemWebUrl } : {}),
    relistingGroupId: groupForHistoryTitle(item.title, matchingPreferences)
  };
}

function groupForHistoryTitle(title: string, matchingPreferences: MatchingPreferences): string | undefined {
  const catalogueId = catalogueIdForTitle(title, matchingPreferences.criteriaText);
  return catalogueId ? `criteria:${catalogueId}` : relistingGroupForTitle(title, matchingPreferences);
}

function parseDate(value: string | undefined): Date | undefined {
  if (!value) {
    return undefined;
  }

  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : undefined;
}
