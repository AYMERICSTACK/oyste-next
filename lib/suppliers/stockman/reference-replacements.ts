import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { ResolutionError } from "./global-import/runtime-errors";

export const stockmanReplacementSetting = "stockman.reference-replacements.v1";
const reference = z.string().trim().min(1).max(80);
export const stockmanReplacementSchema = z.object({
  formerReference: reference,
  successorReference: reference.nullable(),
  family: z.string().min(1).max(100),
  category: z.string().min(1).max(200),
  sourceUrl: z.url().refine(value => {
    const url = new URL(value);
    return url.protocol === "https:" && ["stockman.fr", "www.stockman.fr"].includes(url.hostname) && !url.username && !url.password;
  }).nullable(),
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

type StockmanReplacement = z.infer<typeof stockmanReplacementSchema>;

export async function registerStockmanReplacements(records: StockmanReplacement[], actorId: string) {
  if (process.env.STOCKMAN_COLLECTIVE_REGISTRY_AUTHORIZED !== "true") {
    throw new ResolutionError("REPLACEMENT_WRITES_DISABLED", "L’enregistrement du registre nécessite une autorisation explicite.", 423);
  }
  return prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(193701, 7)`;
    const row = await tx.siteSetting.findUnique({ where: { key: stockmanReplacementSetting }, select: { value: true } });
    const old = row ? stockmanReplacementsSchema.parse(row.value) : [];
    const byCode = new Map(old.map(item => [item.formerReference.toUpperCase(), item]));
    const additions: StockmanReplacement[] = [];
    const resolved: StockmanReplacement[] = [];
    for (const item of records) {
      const former = item.formerReference.toUpperCase();
      const previous = byCode.get(former);
      if (previous) {
        if (JSON.stringify(previous) === JSON.stringify(item)) continue;
        if (!previous.successorReference && item.successorReference) {
          byCode.set(former, item);
          resolved.push(previous);
        } else {
          throw new ResolutionError("REPLACEMENT_CONFLICT", "Une preuve existe déjà pour " + former + ". Contrôlez la correspondance avant toute modification.", 409);
        }
      } else {
        additions.push(item);
      }
    }
    const value = stockmanReplacementsSchema.parse([...byCode.values(), ...additions]);
    if (!additions.length && !resolved.length) return { total: value.length, added: 0, resolved: 0 };
    await tx.siteSetting.upsert({
      where: { key: stockmanReplacementSetting },
      create: { key: stockmanReplacementSetting, isPublic: false, value },
      update: { isPublic: false, value },
    });
    await tx.auditLog.create({ data: {
      userId: actorId, action: "STOCKMAN_REPLACEMENTS_REGISTERED", entityType: "SiteSetting",
      entityId: stockmanReplacementSetting, metadata: { references: additions.map(item => item.formerReference), previousUnresolved: resolved },
    } });
    return { total: value.length, added: additions.length, resolved: resolved.length };
  });
}
