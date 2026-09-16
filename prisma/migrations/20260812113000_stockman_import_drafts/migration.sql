CREATE TABLE "StockmanImportDraft" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "designation" TEXT NOT NULL,
    "category" TEXT,
    "sourceUrl" TEXT NOT NULL,
    "purchasePriceExVat" DECIMAL(12,2),
    "stock" INTEGER,
    "weightKg" DECIMAL(12,3),
    "status" TEXT NOT NULL DEFAULT 'PREPARED',
    "sourceReadAt" TIMESTAMP(3),
    "preparedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "StockmanImportDraft_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "StockmanImportDraft_reference_key" ON "StockmanImportDraft"("reference");
CREATE INDEX "StockmanImportDraft_status_idx" ON "StockmanImportDraft"("status");
CREATE INDEX "StockmanImportDraft_preparedAt_idx" ON "StockmanImportDraft"("preparedAt");
