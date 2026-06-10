-- CreateEnum
CREATE TYPE "Venue" AS ENUM ('ebay');

-- CreateEnum
CREATE TYPE "ImportRunStatus" AS ENUM ('running', 'succeeded', 'failed');

-- CreateTable
CREATE TABLE "WonItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "venue" "Venue" NOT NULL DEFAULT 'ebay',
    "venueItemId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "itemPriceAmount" DECIMAL(20,2),
    "currency" TEXT,
    "purchasedAt" TIMESTAMP(3),
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

    CONSTRAINT "WonItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WonItemImportRun" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "venue" "Venue" NOT NULL DEFAULT 'ebay',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "status" "ImportRunStatus" NOT NULL DEFAULT 'running',
    "liveWonCount" INTEGER NOT NULL DEFAULT 0,
    "insertedCount" INTEGER NOT NULL DEFAULT 0,
    "updatedCount" INTEGER NOT NULL DEFAULT 0,
    "errorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WonItemImportRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WonItem_userId_purchasedAt_idx" ON "WonItem"("userId", "purchasedAt");

-- CreateIndex
CREATE UNIQUE INDEX "WonItem_userId_venue_venueItemId_key" ON "WonItem"("userId", "venue", "venueItemId");

-- CreateIndex
CREATE INDEX "WonItemImportRun_userId_startedAt_idx" ON "WonItemImportRun"("userId", "startedAt");
