-- CreateTable
CREATE TABLE "LostItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "venue" "Venue" NOT NULL DEFAULT 'ebay',
    "venueItemId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "maxBidAmount" DECIMAL(20,2),
    "maxBidCurrency" TEXT,
    "soldPriceAmount" DECIMAL(20,2),
    "soldPriceCurrency" TEXT,
    "endedAt" TIMESTAMP(3),
    "sellerUserId" TEXT,
    "conditionDisplayName" TEXT,
    "categoryId" TEXT,
    "categoryName" TEXT,
    "imageUrl" TEXT,
    "itemWebUrl" TEXT,
    "firstImportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastImportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LostItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LostItemImportRun" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "venue" "Venue" NOT NULL DEFAULT 'ebay',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "status" "ImportRunStatus" NOT NULL DEFAULT 'running',
    "liveLostCount" INTEGER NOT NULL DEFAULT 0,
    "insertedCount" INTEGER NOT NULL DEFAULT 0,
    "updatedCount" INTEGER NOT NULL DEFAULT 0,
    "errorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LostItemImportRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LostItem_userId_endedAt_idx" ON "LostItem"("userId", "endedAt");

-- CreateIndex
CREATE UNIQUE INDEX "LostItem_userId_venue_venueItemId_key" ON "LostItem"("userId", "venue", "venueItemId");

-- CreateIndex
CREATE INDEX "LostItemImportRun_userId_startedAt_idx" ON "LostItemImportRun"("userId", "startedAt");
