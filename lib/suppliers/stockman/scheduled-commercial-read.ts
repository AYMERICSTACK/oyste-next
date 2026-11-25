import { prisma } from "@/lib/db/prisma";
import { startStockmanDiscoveryJob, StockmanDiscoveryConflict } from "./discovery-jobs";
import { getSharedStockmanScope } from "./shared-commercial-scope";

const day = 24 * 60 * 60 * 1000;
const scopedAuditInterval = 7 * day;

export async function startDueStockmanCommercialRead(now = new Date()) {
  if (process.env.STOCKMAN_SCHEDULED_COMMERCIAL_READS !== "true") return false;
  if (process.env.VERCEL_ENV === "production" && process.env.STOCKMAN_SCHEDULED_COMMERCIAL_SYNC !== "true") return false;
  const scope = await getSharedStockmanScope();
  if (!scope) return false;
  const filters = [
    { options: { path: ["scheduledCommercialRead"], equals: true } },
    { options: { path: ["commercialScope"], equals: scope.keys } },
    { options: { path: ["excludedReferences"], equals: scope.exclusions } },
  ];
  const lastRead = await prisma.stockmanDiscoveryJob.findFirst({
    where: { AND: filters, createdAt: { gte: new Date(now.getTime() - day) } },
    select: { id: true },
  });
  if (lastRead) return false;
  const audit = await prisma.stockmanDiscoveryJob.findFirst({
    where: {
      AND: [...filters, { options: { path: ["scopeMode"], equals: "audit" } }],
      createdAt: { gte: new Date(now.getTime() - scopedAuditInterval) },
    }, select: { id: true },
  });
  try {
    await startStockmanDiscoveryJob({ commercialScope: scope.keys, excludedReferences: scope.exclusions,
      scopeMode: audit ? "commercial" : "audit", scheduledCommercialRead: true });
    return true;
  } catch (error) {
    if (error instanceof StockmanDiscoveryConflict) return false;
    throw error;
  }
}
