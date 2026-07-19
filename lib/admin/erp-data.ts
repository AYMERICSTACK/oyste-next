import { prisma } from "@/lib/db/prisma";

export async function getErpDashboardData() {
  const [imports, products, ouvrages, families] = await Promise.all([
    prisma.erpImport.findMany({ orderBy: { startedAt: "desc" }, take: 12 }),
    prisma.erpProductRecord.count({ where: { isActive: true } }),
    prisma.erpOuvrageRecord.count({ where: { isActive: true } }),
    prisma.erpFamilyRecord.count({ where: { isActive: true } }),
  ]);

  return {
    counts: { products, ouvrages, families },
    imports: imports.map((item) => ({
      id: item.id,
      source: item.source,
      status: item.status,
      startedAt: item.startedAt,
      completedAt: item.completedAt,
      stats: item.stats as Record<string, number> | null,
      changes: item.changes as Record<string, unknown> | null,
      errorMessage: item.errorMessage,
    })),
  };
}
