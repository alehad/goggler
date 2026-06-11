import { rebuildHistoryResponse } from "../ebay/history-assembly.ts";
import type { EbayHistoryResponse } from "../ebay/history-response.ts";
import {
  catalogueIdForTitle,
  relistingGroupForTitle,
  type MatchingPreferences
} from "../ebay/matching-preferences.ts";
import type { EbayBuyingHistoryItem } from "../ebay/trading-client.ts";
import type { PrismaClient } from "../generated/prisma/client.ts";
import { getPrismaClient } from "./prisma.ts";

export async function persistLostItemsAndMerge(
  history: EbayHistoryResponse,
  userId: string,
  matchingPreferences: MatchingPreferences,
  prisma: PrismaClient | undefined = getPrismaClient()
): Promise<EbayHistoryResponse> {
  if (!prisma || history.source !== "live") {
    return history;
  }

  const now = new Date();
  const liveLostItems = history.lostItems;
  const importRun = await prisma.lostItemImportRun.create({
    data: {
      userId,
      liveLostCount: liveLostItems.length
    }
  });

  try {
    const existing = await prisma.lostItem.findMany({
      select: { venueItemId: true },
      where: {
        userId,
        venue: "ebay",
        venueItemId: { in: liveLostItems.map((item) => item.itemId) }
      }
    });
    const existingIds = new Set(existing.map((item) => item.venueItemId));

    await prisma.$transaction([
      ...liveLostItems.map((item) =>
        prisma.lostItem.upsert({
          create: toLostItemCreate(item, userId, now),
          update: toLostItemUpdate(item, now),
          where: {
            userId_venue_venueItemId: {
              userId,
              venue: "ebay",
              venueItemId: item.itemId
            }
          }
        })
      ),
      prisma.lostItemImportRun.update({
        data: {
          completedAt: now,
          insertedCount: liveLostItems.filter((item) => !existingIds.has(item.itemId)).length,
          status: "succeeded",
          updatedCount: liveLostItems.filter((item) => existingIds.has(item.itemId)).length
        },
        where: { id: importRun.id }
      })
    ]);
  } catch (error) {
    await prisma.lostItemImportRun.update({
      data: {
        completedAt: new Date(),
        errorCode: "lost_item_import_failed",
        status: "failed"
      },
      where: { id: importRun.id }
    }).catch(() => undefined);
    throw error;
  }

  const persistedLostItems = await prisma.lostItem.findMany({
    orderBy: [{ endedAt: "desc" }, { createdAt: "desc" }],
    where: { userId, venue: "ebay" }
  });

  return rebuildHistoryResponse(history, {
    lostItems: persistedLostItems.map((item) => ({
      itemId: item.venueItemId,
      title: item.title,
      list: "LostList",
      currentPrice: item.soldPriceAmount && item.soldPriceCurrency
        ? { value: item.soldPriceAmount.toNumber(), currency: item.soldPriceCurrency }
        : undefined,
      maxBid: item.maxBidAmount && item.maxBidCurrency
        ? { value: item.maxBidAmount.toNumber(), currency: item.maxBidCurrency }
        : undefined,
      endTime: item.endedAt?.toISOString(),
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

function toLostItemCreate(item: EbayBuyingHistoryItem, userId: string, now: Date) {
  return {
    userId,
    venue: "ebay" as const,
    venueItemId: item.itemId,
    title: item.title,
    maxBidAmount: item.maxBid?.value,
    maxBidCurrency: item.maxBid?.currency,
    soldPriceAmount: item.currentPrice?.value,
    soldPriceCurrency: item.currentPrice?.currency,
    endedAt: parseDate(item.endTime),
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

function toLostItemUpdate(item: EbayBuyingHistoryItem, now: Date) {
  const endedAt = parseDate(item.endTime);
  return {
    title: item.title,
    ...(item.maxBid ? { maxBidAmount: item.maxBid.value, maxBidCurrency: item.maxBid.currency } : {}),
    ...(item.currentPrice ? { soldPriceAmount: item.currentPrice.value, soldPriceCurrency: item.currentPrice.currency } : {}),
    ...(endedAt ? { endedAt } : {}),
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
