ALTER TABLE "Product"
  ADD COLUMN "packageLengthCm" DECIMAL(12,2),
  ADD COLUMN "packageWidthCm" DECIMAL(12,2),
  ADD COLUMN "packageHeightCm" DECIMAL(12,2);

ALTER TABLE "ProductVariant"
  ADD COLUMN "packageLengthCm" DECIMAL(12,2),
  ADD COLUMN "packageWidthCm" DECIMAL(12,2),
  ADD COLUMN "packageHeightCm" DECIMAL(12,2);
