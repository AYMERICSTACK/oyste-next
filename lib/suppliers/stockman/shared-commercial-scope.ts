import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { normalizeStockmanCommercialExclusions, resolveStockmanCommercialScope } from "./commercial-scope";

export const stockmanCommercialSetting = "stockman.commercial-scope.v1";

export const stockmanCommercialSettingSchema = z.object({
  keys: z.array(z.string().regex(/^\d+(?::\d+)?$/)).min(1).max(150),
  exclusions: z.array(z.string().trim().min(1).max(31)).max(500),
});

export function parseSharedStockmanScope(value: unknown) {
  const parsed = stockmanCommercialSettingSchema.parse(value);
  return { keys: resolveStockmanCommercialScope(parsed.keys).keys, exclusions: normalizeStockmanCommercialExclusions(parsed.exclusions) };
}

export async function getSharedStockmanScope() {
  const row = await prisma.siteSetting.findUnique({ where: { key: stockmanCommercialSetting }, select: { value: true, updatedAt: true } });
  return row ? { ...parseSharedStockmanScope(row.value), version: row.updatedAt.toISOString() } : null;
}
