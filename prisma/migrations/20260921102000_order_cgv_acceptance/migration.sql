-- Preserve the exact CGV version accepted when an OYSTE order is placed.
ALTER TABLE "Order"
ADD COLUMN "cgvVersion" TEXT,
ADD COLUMN "cgvAcceptedAt" TIMESTAMP(3);
