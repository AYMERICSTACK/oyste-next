-- OYSTE Facturation V2: turn Invoice into an accounting snapshot while preserving legacy uploaded PDFs.
CREATE TYPE "InvoiceType" AS ENUM ('INVOICE', 'CREDIT_NOTE');
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'CANCELLED');
CREATE TYPE "InvoiceElectronicStatus" AS ENUM ('NOT_APPLICABLE', 'PENDING', 'SENT', 'ACCEPTED', 'REJECTED');

ALTER TABLE "Invoice"
  ADD COLUMN "sourceKey" TEXT,
  ADD COLUMN "type" "InvoiceType" NOT NULL DEFAULT 'INVOICE',
  ADD COLUMN "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN "issuedAt" TIMESTAMP(3),
  ADD COLUMN "sellerName" TEXT,
  ADD COLUMN "sellerBrand" TEXT,
  ADD COLUMN "sellerSiren" TEXT,
  ADD COLUMN "sellerSiret" TEXT,
  ADD COLUMN "sellerVatNumber" TEXT,
  ADD COLUMN "sellerAddress1" TEXT,
  ADD COLUMN "sellerAddress2" TEXT,
  ADD COLUMN "sellerPostalCode" TEXT,
  ADD COLUMN "sellerCity" TEXT,
  ADD COLUMN "sellerCountry" TEXT,
  ADD COLUMN "buyerEmail" TEXT,
  ADD COLUMN "buyerFirstName" TEXT,
  ADD COLUMN "buyerLastName" TEXT,
  ADD COLUMN "buyerCompany" TEXT,
  ADD COLUMN "buyerSiren" TEXT,
  ADD COLUMN "buyerSiret" TEXT,
  ADD COLUMN "buyerVatNumber" TEXT,
  ADD COLUMN "buyerAddress1" TEXT,
  ADD COLUMN "buyerAddress2" TEXT,
  ADD COLUMN "buyerPostalCode" TEXT,
  ADD COLUMN "buyerCity" TEXT,
  ADD COLUMN "buyerCountry" TEXT,
  ADD COLUMN "buyerElectronicAddress" TEXT,
  ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'EUR',
  ADD COLUMN "subtotalHt" DECIMAL(12,2),
  ADD COLUMN "taxAmount" DECIMAL(12,2),
  ADD COLUMN "totalTtc" DECIMAL(12,2),
  ADD COLUMN "paymentMethod" "PaymentMethod",
  ADD COLUMN "paymentStatus" "PaymentStatus",
  ADD COLUMN "paymentReference" TEXT,
  ADD COLUMN "paidAt" TIMESTAMP(3),
  ADD COLUMN "electronicStatus" "InvoiceElectronicStatus" NOT NULL DEFAULT 'NOT_APPLICABLE',
  ADD COLUMN "electronicProvider" TEXT,
  ADD COLUMN "electronicRoutingAddress" TEXT,
  ADD COLUMN "electronicExternalId" TEXT,
  ADD COLUMN "electronicSentAt" TIMESTAMP(3),
  ADD COLUMN "electronicUpdatedAt" TIMESTAMP(3),
  ADD COLUMN "electronicError" TEXT;

ALTER TABLE "Invoice" ALTER COLUMN "filename" DROP NOT NULL;
ALTER TABLE "Invoice" ALTER COLUMN "mimeType" DROP NOT NULL;
ALTER TABLE "Invoice" ALTER COLUMN "size" DROP NOT NULL;
ALTER TABLE "Invoice" ALTER COLUMN "pdfData" DROP NOT NULL;

CREATE UNIQUE INDEX "Invoice_sourceKey_key" ON "Invoice"("sourceKey");
CREATE UNIQUE INDEX "Invoice_number_key" ON "Invoice"("number");
CREATE INDEX "Invoice_status_createdAt_idx" ON "Invoice"("status", "createdAt");

ALTER TABLE "Invoice" DROP CONSTRAINT "Invoice_orderId_fkey";
ALTER TABLE "Invoice" DROP CONSTRAINT "Invoice_customerId_fkey";
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "InvoiceLine" (
  "id" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "name" TEXT NOT NULL,
  "reference" TEXT,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "unitPriceHt" DECIMAL(12,2) NOT NULL,
  "totalHt" DECIMAL(12,2) NOT NULL,
  "vatRate" DECIMAL(5,2) NOT NULL,
  "taxAmount" DECIMAL(12,2) NOT NULL,
  "totalTtc" DECIMAL(12,2) NOT NULL,
  "configuration" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InvoiceLine_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "InvoiceLine_invoiceId_sortOrder_idx" ON "InvoiceLine"("invoiceId", "sortOrder");
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
