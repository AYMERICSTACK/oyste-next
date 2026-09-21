ALTER TABLE "Invoice" ADD COLUMN "publishedAt" TIMESTAMP(3);

-- Existing PDF invoices were already visible in the customer account before V2.
-- Preserve that behavior while allowing newly generated V2 PDFs to remain BO-only
-- until a later explicit publication step.
UPDATE "Invoice"
SET "publishedAt" = "createdAt"
WHERE "pdfData" IS NOT NULL AND "publishedAt" IS NULL;
