-- Prepare customer identity for B2B electronic invoicing.
-- Existing customers remain compatible: SIREN is nullable until their profile is completed.
ALTER TABLE "Customer" ADD COLUMN "siren" TEXT;

CREATE UNIQUE INDEX "Customer_siren_key" ON "Customer"("siren");
