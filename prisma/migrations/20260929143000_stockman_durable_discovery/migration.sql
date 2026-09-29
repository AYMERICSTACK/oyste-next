-- Durable, resumable Stockman catalogue discovery.
CREATE TABLE "StockmanDiscoveryJob" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "phase" TEXT NOT NULL DEFAULT 'DISCOVERING',
    "options" JSONB NOT NULL,
    "progress" JSONB NOT NULL,
    "diagnostics" JSONB,
    "result" JSONB,
    "error" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "leaseOwner" TEXT,
    "leaseExpiresAt" TIMESTAMP(3),
    "leaseVersion" INTEGER NOT NULL DEFAULT 0,
    "checkpointVersion" INTEGER NOT NULL DEFAULT 0,
    "cancelRequestedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "StockmanDiscoveryJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StockmanDiscoveryQueueItem" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "canonicalUrl" TEXT NOT NULL,
    "urlHash" TEXT NOT NULL,
    "nodeType" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "depth" INTEGER NOT NULL DEFAULT 0,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "branchKey" TEXT,
    "claimVersion" INTEGER,
    "discoveredFrom" TEXT,
    "label" TEXT,
    "leaseOwner" TEXT,
    "leaseExpiresAt" TIMESTAMP(3),
    "lastError" TEXT,
    "trace" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "StockmanDiscoveryQueueItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StockmanDiscoveryResult" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "occurrenceKey" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "relationType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "StockmanDiscoveryResult_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StockmanDiscoveryJob_status_updatedAt_idx" ON "StockmanDiscoveryJob"("status", "updatedAt");
CREATE INDEX "StockmanDiscoveryJob_leaseExpiresAt_idx" ON "StockmanDiscoveryJob"("leaseExpiresAt");
CREATE UNIQUE INDEX "StockmanDiscoveryQueueItem_jobId_nodeType_urlHash_key" ON "StockmanDiscoveryQueueItem"("jobId", "nodeType", "urlHash");
CREATE INDEX "StockmanDiscoveryQueueItem_jobId_state_priority_createdAt_idx" ON "StockmanDiscoveryQueueItem"("jobId", "state", "priority", "createdAt");
CREATE INDEX "StockmanDiscoveryQueueItem_jobId_branchKey_state_idx" ON "StockmanDiscoveryQueueItem"("jobId", "branchKey", "state");
CREATE INDEX "StockmanDiscoveryQueueItem_leaseExpiresAt_idx" ON "StockmanDiscoveryQueueItem"("leaseExpiresAt");
CREATE UNIQUE INDEX "StockmanDiscoveryResult_jobId_occurrenceKey_key" ON "StockmanDiscoveryResult"("jobId", "occurrenceKey");
CREATE INDEX "StockmanDiscoveryResult_jobId_reference_idx" ON "StockmanDiscoveryResult"("jobId", "reference");
CREATE INDEX "StockmanDiscoveryResult_jobId_relationType_idx" ON "StockmanDiscoveryResult"("jobId", "relationType");

ALTER TABLE "StockmanDiscoveryQueueItem" ADD CONSTRAINT "StockmanDiscoveryQueueItem_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "StockmanDiscoveryJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StockmanDiscoveryResult" ADD CONSTRAINT "StockmanDiscoveryResult_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "StockmanDiscoveryJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
