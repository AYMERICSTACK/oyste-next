CREATE TABLE "AdminNotificationRead" (
    "id" TEXT NOT NULL,
    "notificationKey" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminNotificationRead_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AdminNotificationRead_adminId_notificationKey_key"
ON "AdminNotificationRead"("adminId", "notificationKey");

CREATE INDEX "AdminNotificationRead_adminId_readAt_idx"
ON "AdminNotificationRead"("adminId", "readAt");

ALTER TABLE "AdminNotificationRead"
ADD CONSTRAINT "AdminNotificationRead_adminId_fkey"
FOREIGN KEY ("adminId") REFERENCES "AdminUser"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
