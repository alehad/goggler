-- CreateTable
CREATE TABLE "MarketPriceRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "venue" "Venue" NOT NULL DEFAULT 'ebay',
    "venueItemId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "soldPriceAmount" DECIMAL(20,2),
    "soldPriceCurrency" TEXT,
    "endedAt" TIMESTAMP(3),
    "sellerUserId" TEXT,
    "conditionDisplayName" TEXT,
    "categoryId" TEXT,
    "categoryName" TEXT,
    "imageUrl" TEXT,
    "itemWebUrl" TEXT,
    "relistingGroupId" TEXT,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketPriceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MarketPriceRecord_userId_relistingGroupId_idx" ON "MarketPriceRecord"("userId", "relistingGroupId");

-- CreateIndex
CREATE INDEX "MarketPriceRecord_userId_endedAt_idx" ON "MarketPriceRecord"("userId", "endedAt");

-- CreateIndex
CREATE UNIQUE INDEX "MarketPriceRecord_userId_venue_venueItemId_key" ON "MarketPriceRecord"("userId", "venue", "venueItemId");
