CREATE TYPE "ErpImportStatus" AS ENUM ('RUNNING', 'COMPLETED', 'SKIPPED', 'FAILED');

CREATE TABLE "ErpImport" (
  "id" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "sourceHash" TEXT NOT NULL,
  "status" "ErpImportStatus" NOT NULL DEFAULT 'RUNNING',
  "snapshotDate" TIMESTAMP(3),
  "stats" JSONB,
  "changes" JSONB,
  "errorMessage" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ErpImport_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ErpFamilyRecord" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "ouvragesCount" INTEGER NOT NULL DEFAULT 0,
  "productsCount" INTEGER NOT NULL DEFAULT 0,
  "samples" JSONB,
  "contentHash" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastImportId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ErpFamilyRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ErpProductRecord" (
  "id" TEXT NOT NULL,
  "ref" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "description" TEXT,
  "family" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "costPrice" DECIMAL(12,2) NOT NULL,
  "attributes" JSONB,
  "contentHash" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastImportId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ErpProductRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ErpOuvrageRecord" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "description" TEXT,
  "family" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "mainComponentCode" TEXT,
  "basePrice" DECIMAL(12,2) NOT NULL,
  "defaultTotal" DECIMAL(12,2) NOT NULL,
  "attributes" JSONB,
  "components" JSONB,
  "contentHash" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastImportId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ErpOuvrageRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ErpImport_status_startedAt_idx" ON "ErpImport"("status", "startedAt");
CREATE INDEX "ErpImport_sourceHash_idx" ON "ErpImport"("sourceHash");
CREATE UNIQUE INDEX "ErpFamilyRecord_code_key" ON "ErpFamilyRecord"("code");
CREATE INDEX "ErpFamilyRecord_category_idx" ON "ErpFamilyRecord"("category");
CREATE INDEX "ErpFamilyRecord_isActive_idx" ON "ErpFamilyRecord"("isActive");
CREATE INDEX "ErpFamilyRecord_lastImportId_idx" ON "ErpFamilyRecord"("lastImportId");
CREATE UNIQUE INDEX "ErpProductRecord_ref_key" ON "ErpProductRecord"("ref");
CREATE INDEX "ErpProductRecord_family_idx" ON "ErpProductRecord"("family");
CREATE INDEX "ErpProductRecord_category_idx" ON "ErpProductRecord"("category");
CREATE INDEX "ErpProductRecord_isActive_idx" ON "ErpProductRecord"("isActive");
CREATE INDEX "ErpProductRecord_lastImportId_idx" ON "ErpProductRecord"("lastImportId");
CREATE UNIQUE INDEX "ErpOuvrageRecord_code_key" ON "ErpOuvrageRecord"("code");
CREATE INDEX "ErpOuvrageRecord_family_idx" ON "ErpOuvrageRecord"("family");
CREATE INDEX "ErpOuvrageRecord_category_idx" ON "ErpOuvrageRecord"("category");
CREATE INDEX "ErpOuvrageRecord_isActive_idx" ON "ErpOuvrageRecord"("isActive");
CREATE INDEX "ErpOuvrageRecord_lastImportId_idx" ON "ErpOuvrageRecord"("lastImportId");

ALTER TABLE "ErpFamilyRecord" ADD CONSTRAINT "ErpFamilyRecord_lastImportId_fkey" FOREIGN KEY ("lastImportId") REFERENCES "ErpImport"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ErpProductRecord" ADD CONSTRAINT "ErpProductRecord_lastImportId_fkey" FOREIGN KEY ("lastImportId") REFERENCES "ErpImport"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ErpOuvrageRecord" ADD CONSTRAINT "ErpOuvrageRecord_lastImportId_fkey" FOREIGN KEY ("lastImportId") REFERENCES "ErpImport"("id") ON DELETE SET NULL ON UPDATE CASCADE;
