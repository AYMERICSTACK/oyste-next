CREATE TYPE "PaymentMethod" AS ENUM ('BANK_TRANSFER', 'CARD', 'INVOICE');
ALTER TABLE "Order"
  ADD COLUMN "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'BANK_TRANSFER',
  ADD COLUMN "paymentReference" TEXT,
  ADD COLUMN "paymentInstructionsSentAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "Order_paymentReference_key" ON "Order"("paymentReference");
