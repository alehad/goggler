-- CreateTable
CREATE TABLE "MatchingPreferences" (
    "userId" TEXT NOT NULL,
    "exactTitleMatch" BOOLEAN NOT NULL DEFAULT true,
    "criteriaText" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatchingPreferences_pkey" PRIMARY KEY ("userId")
);
