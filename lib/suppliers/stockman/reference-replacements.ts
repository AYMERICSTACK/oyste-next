import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";

export const stockmanReplacementSetting = "stockman.reference-replacements.v1";
const reference = z.string().trim().min(1).max(80);
export const stockmanReplacementSchema = z.object({
  formerReference: reference,
  successorReference: reference.nullable(),
  family: z.string().min(1).max(100),
  category: z.string().min(1).max(200),
  sourceUrl: z.url().nullable(),
  evidence: z.string().min(1).max(1000),
  observedAt: z.iso.datetime().nullable(),
  oysteReference: reference.nullable(),
}).strict().refine(row =>
  row.formerReference.toUpperCase() !== row.successorReference?.toUpperCase() &&
  (!row.successorReference || Boolean(row.sourceUrl && row.observedAt)));

export const stockmanReplacementsSchema = z.array(stockmanReplacementSchema).max(5000)
  .refine(rows => new Set(rows.map(row => row.formerReference.toUpperCase())).size === rows.length);

export async function readStockmanReplacementHolds(db: Prisma.TransactionClient) {
  const row = await db.siteSetting.findUnique({where:{key:stockmanReplacementSetting},select:{value:true}});
  if (!row) return new Set<string>();
  const records = stockmanReplacementsSchema.parse(row.value);
  return new Set(records.map(item => item.formerReference.trim().toUpperCase()));
}
