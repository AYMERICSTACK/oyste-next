-- Dedicated yearly counter for OYSTE invoice numbering.
-- Invoice numbers remain stored on Invoice.number; this table only allocates the next number atomically.
CREATE TABLE "InvoiceSequence" (
    "year" INTEGER NOT NULL,
    "lastNumber" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvoiceSequence_pkey" PRIMARY KEY ("year")
);
