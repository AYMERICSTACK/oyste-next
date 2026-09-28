CREATE TABLE "StockmanAuthSession" (
  "id" TEXT NOT NULL,
  "encryptedState" TEXT NOT NULL,
  "validatedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "StockmanAuthSession_pkey" PRIMARY KEY ("id")
);
