CREATE TYPE "ShippingMode" AS ENUM ('INCLUDED', 'MESSAGERIE', 'AFFRETEMENT', 'QUOTE');
ALTER TABLE "Product" ADD COLUMN "weightKg" DECIMAL(12,3), ADD COLUMN "shippingMode" "ShippingMode" NOT NULL DEFAULT 'QUOTE';
ALTER TABLE "ProductVariant" ADD COLUMN "weightKg" DECIMAL(12,3), ADD COLUMN "shippingMode" "ShippingMode";
CREATE INDEX "Product_shippingMode_idx" ON "Product"("shippingMode");
