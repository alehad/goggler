import { rebuildHistoryResponse } from "../ebay/history-assembly.ts";
import type { EbayHistoryResponse } from "../ebay/history-response.ts";
import {
  catalogueIdForTitle,
  relistingGroupForTitle,
  type MatchingPreferences
} from "../ebay/matching-preferences.ts";
import type { EbayBuyingHistoryItem } from "../ebay/trading-client.ts";
import type { PrismaClient } from "../generated/prisma/client.ts";
import type { MarketPriceRecordSale } from "./market-price-records.ts";
import { getPrismaClient } from "./prisma.ts";

export async function persistWonItemsAndMerge(
  history: EbayHistoryResponse,
  userId: string,
  matchingPreferences: MatchingPreferences,
  prisma: PrismaClient | undefined = getPrismaClient()
): Promise<EbayHistoryResponse> {
  if (!prisma || history.source !== "live") {
    return history;
  }

  const now = new Date();
  const liveWonItems = history.wonItems;
  const importRun = await prisma.wonItemImportRun.create({
    data: {
      userId,
      liveWonCount: liveWonItems.length
    }
  });

  try {
    const existing = await prisma.wonItem.findMany({
      select: { venueItemId: true },
      where: {
        userId,
        venueItemId: { in: liveWonItems.map((item) => item.itemId) }
      }
    });
    const existingIds = new Set(existing.map((item) => item.venueItemId));

    await prisma.$transaction([
      ...liveWonItems.map((item) =>
        prisma.wonItem.upsert({
          create: toWonItemCreate(item, userId, now),
          update: toWonItemUpdate(item, now),
          where: {
            userId_venue_venueItemId: {
              userId,
              venue: "ebay",
              venueItemId: item.itemId
            }
          }
        })
      ),
      prisma.wonItemImportRun.update({
        data: {
          completedAt: now,
          insertedCount: liveWonItems.filter((item) => !existingIds.has(item.itemId)).length,
          status: "succeeded",
          updatedCount: liveWonItems.filter((item) => existingIds.has(item.itemId)).length
        },
        where: { id: importRun.id }
      })
    ]);
  } catch (error) {
    await prisma.wonItemImportRun.update({
      data: {
        completedAt: new Date(),
        errorCode: "won_item_import_failed",
        status: "failed"
      },
      where: { id: importRun.id }
    }).catch(() => undefined);
    throw error;
  }

  const persistedWonItems = await prisma.wonItem.findMany({
    orderBy: [{ purchasedAt: "desc" }, { createdAt: "desc" }],
    where: { userId, venue: "ebay" }
  });

  return rebuildHistoryResponse(history, {
    wonItems: persistedWonItems.map((item) => ({
      itemId: item.venueItemId,
      title: item.title,
      list: "WonList",
      currentPrice: item.itemPriceAmount && item.currency
        ? { value: item.itemPriceAmount.toNumber(), currency: item.currency }
        : undefined,
      endTime: item.purchasedAt?.toISOString(),
      sellerUserId: item.sellerUserId ?? undefined,
      conditionDisplayName: item.conditionDisplayName ?? undefined,
      categoryId: item.categoryId ?? undefined,
      categoryName: item.categoryName ?? undefined,
      imageUrl: item.imageUrl ?? undefined,
      itemWebUrl: item.itemWebUrl ?? undefined,
      relistingGroupId: groupForHistoryTitle(item.title, matchingPreferences)
    }))
  });
}

export async function listWonItemsForGroup(
  userId: string,
  relistingGroupId: string,
  currency: string,
  matchingPreferences: MatchingPreferences,
  prisma: PrismaClient | undefined = getPrismaClient()
): Promise<MarketPriceRecordSale[]> {
  if (!prisma) {
    return [];
  }

  const wonItems = await prisma.wonItem.findMany({
    where: { userId, venue: "ebay", currency }
  });

  return wonItems.flatMap((item) => {
    if (item.itemPriceAmount === null || !item.currency) {
      return [];
    }
    if (groupForHistoryTitle(item.title, matchingPreferences) !== relistingGroupId) {
      return [];
    }

    return [{
      venueItemId: item.venueItemId,
      title: item.title,
      price: { value: item.itemPriceAmount.toNumber(), currency: item.currency },
      endedAt: item.purchasedAt?.toISOString()
    }];
  });
}

function toWonItemCreate(item: EbayBuyingHistoryItem, userId: string, now: Date) {
  return {
    userId,
    venue: "ebay" as const,
    venueItemId: item.itemId,
    title: item.title,
    itemPriceAmount: item.currentPrice?.value,
    currency: item.currentPrice?.currency,
    purchasedAt: parseDate(item.endTime),
    sellerUserId: item.sellerUserId,
    conditionDisplayName: item.conditionDisplayName,
    categoryId: item.categoryId,
    categoryName: item.categoryName,
    imageUrl: item.imageUrl,
    itemWebUrl: item.itemWebUrl,
    firstImportedAt: now,
    lastImportedAt: now
  };
}

function toWonItemUpdate(item: EbayBuyingHistoryItem, now: Date) {
  return {
    title: item.title,
    ...(item.currentPrice ? { itemPriceAmount: item.currentPrice.value, currency: item.currentPrice.currency } : {}),
    ...(item.endTime ? { purchasedAt: parseDate(item.endTime) } : {}),
    ...(item.sellerUserId ? { sellerUserId: item.sellerUserId } : {}),
    ...(item.conditionDisplayName ? { conditionDisplayName: item.conditionDisplayName } : {}),
    ...(item.categoryId ? { categoryId: item.categoryId } : {}),
    ...(item.categoryName ? { categoryName: item.categoryName } : {}),
    ...(item.imageUrl ? { imageUrl: item.imageUrl } : {}),
    ...(item.itemWebUrl ? { itemWebUrl: item.itemWebUrl } : {}),
    lastImportedAt: now
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
