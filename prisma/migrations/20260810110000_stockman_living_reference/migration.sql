CREATE TABLE "StockmanCatalogSnapshot" (
    "id" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3) NOT NULL,
    "referencesCount" INTEGER NOT NULL,
    "pagesVisited" INTEGER NOT NULL,
    "productPages" INTEGER NOT NULL,
    "newCount" INTEGER NOT NULL DEFAULT 0,
    "changedCount" INTEGER NOT NULL DEFAULT 0,
    "disappearedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StockmanCatalogSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StockmanCatalogReference" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "designation" TEXT NOT NULL,
    "category" TEXT,
    "sourceUrl" TEXT NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "lastChangedAt" TIMESTAMP(3) NOT NULL,
    "seenCount" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastMatchStatus" TEXT,
    "lastMatchMethod" TEXT,
    "lastConfidence" INTEGER,
    "lastMissingKind" TEXT,
    "targetType" TEXT,
    "targetId" TEXT,
    "productId" TEXT,
    "targetReference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "StockmanCatalogReference_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StockmanCatalogReference_reference_key" ON "StockmanCatalogReference"("reference");
CREATE INDEX "StockmanCatalogSnapshot_finishedAt_idx" ON "StockmanCatalogSnapshot"("finishedAt");
CREATE INDEX "StockmanCatalogReference_isActive_idx" ON "StockmanCatalogReference"("isActive");
CREATE INDEX "StockmanCatalogReference_lastSeenAt_idx" ON "StockmanCatalogReference"("lastSeenAt");
CREATE INDEX "StockmanCatalogReference_lastMatchStatus_idx" ON "StockmanCatalogReference"("lastMatchStatus");
