ALTER TABLE "Customer"
ADD COLUMN "siret" TEXT,
ADD COLUMN "jobTitle" TEXT,
ADD COLUMN "passwordHash" TEXT;

CREATE UNIQUE INDEX "Customer_siret_key" ON "Customer"("siret");
