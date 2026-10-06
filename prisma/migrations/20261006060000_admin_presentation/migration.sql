ALTER TABLE "Supplier" ADD COLUMN "presentationConfigured" BOOLEAN NOT NULL DEFAULT false,
 ADD COLUMN "homeVisible" BOOLEAN NOT NULL DEFAULT false,
 ADD COLUMN "homeOrder" INTEGER NOT NULL DEFAULT 0,
 ADD COLUMN "homeHref" TEXT;
ALTER TABLE "Category" ADD COLUMN "presentationConfigured" BOOLEAN NOT NULL DEFAULT false,
 ADD COLUMN "catalogueVisible" BOOLEAN NOT NULL DEFAULT true,
 ADD COLUMN "homeVisible" BOOLEAN NOT NULL DEFAULT false,
 ADD COLUMN "homeOrder" INTEGER NOT NULL DEFAULT 0,
 ADD COLUMN "homeImageUrl" TEXT, ADD COLUMN "publicLabel" TEXT, ADD COLUMN "homeLabel" TEXT,
 ADD COLUMN "publicSubtitle" TEXT, ADD COLUMN "publicTags" JSONB,
 ADD COLUMN "publicHref" TEXT, ADD COLUMN "publicFamilySlug" TEXT,
 ADD COLUMN "homeParentId" TEXT, ADD COLUMN "representativeProductId" TEXT;
ALTER TABLE "Category" ADD CONSTRAINT "Category_homeParentId_fkey" FOREIGN KEY ("homeParentId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Category" ADD CONSTRAINT "Category_representativeProductId_fkey" FOREIGN KEY ("representativeProductId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE TABLE "ProductPresentationOverride" (
 "productId" TEXT PRIMARY KEY, "value" JSONB NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "ProductPresentationOverride_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "Category_homeParentId_homeOrder_idx" ON "Category"("homeParentId", "homeOrder");
CREATE INDEX "Supplier_homeVisible_homeOrder_idx" ON "Supplier"("homeVisible", "homeOrder");
