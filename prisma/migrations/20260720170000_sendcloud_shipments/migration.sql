CREATE TABLE "Shipment" (
  "id" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'SENDCLOUD',
  "externalShipmentId" TEXT NOT NULL,
  "parcelId" TEXT,
  "carrierCode" TEXT NOT NULL,
  "carrierName" TEXT NOT NULL,
  "shippingOptionCode" TEXT NOT NULL,
  "shippingOptionName" TEXT NOT NULL,
  "trackingNumber" TEXT,
  "trackingUrl" TEXT,
  "labelUrl" TEXT,
  "weightKg" DECIMAL(8,3) NOT NULL,
  "lengthCm" DECIMAL(8,2) NOT NULL,
  "widthCm" DECIMAL(8,2) NOT NULL,
  "heightCm" DECIMAL(8,2) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'READY_TO_SEND',
  "orderId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Shipment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Shipment_externalShipmentId_key" ON "Shipment"("externalShipmentId");
CREATE UNIQUE INDEX "Shipment_parcelId_key" ON "Shipment"("parcelId");
CREATE UNIQUE INDEX "Shipment_orderId_key" ON "Shipment"("orderId");
CREATE INDEX "Shipment_status_idx" ON "Shipment"("status");
CREATE INDEX "Shipment_createdAt_idx" ON "Shipment"("createdAt");
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
