CREATE TYPE "ProductExperienceType" AS ENUM ('STANDARD', 'CONFIGURABLE');

ALTER TABLE "Product"
ADD COLUMN "experienceType" "ProductExperienceType" NOT NULL DEFAULT 'STANDARD',
ADD COLUMN "configuratorFamily" TEXT,
ADD COLUMN "marketingBadges" JSONB,
ADD COLUMN "faq" JSONB,
ADD COLUMN "videoUrls" JSONB,
ADD COLUMN "relatedProductCodes" JSONB,
ADD COLUMN "accessoryProductCodes" JSONB;

CREATE INDEX "Product_experienceType_idx" ON "Product"("experienceType");
CREATE INDEX "Product_configuratorFamily_idx" ON "Product"("configuratorFamily");
