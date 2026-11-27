import { createHash, createHmac } from "node:crypto";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import catalogue from "@/data/stockman/catalogue-produits.json";
import { auditStockmanMargin } from "../margin-audit";
import { planStockmanReplacements, stockmanReplacementSetting, stockmanReplacementsSchema, writeStockmanReplacementPlan } from "../reference-replacements";
import { selectApprovedStockmanGroups } from "./approved-selection";
import { planGlobal, type Evidence, type Inventory } from "./planner";
import { ResolutionError } from "./runtime-errors";
import { inCommercialScope, SCOPE_VERSION } from "./scope";
import { inventory } from "./service";
import { importStateKey, readImportState } from "./state";

const day = 86_400_000;
const appliedAction = "STOCKMAN_MAINTENANCE_APPLIED";
const rollbackAction = "STOCKMAN_MAINTENANCE_ROLLED_BACK";
const entityType = "StockmanMaintenance";
const keys = [importStateKey, stockmanReplacementSetting];
const code = z.string().trim().min(1).max(80).refine(value => value === value.toUpperCase());
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const date = z.iso.datetime();
const money = z.number().positive().max(1_000_000);
const supplierUrl = z.url().max(2000).refine(value => {
  const url = new URL(value);
  return url.protocol === "https:" && ["stockman.fr", "www.stockman.fr"].includes(url.hostname)
    && !url.username && !url.password && /\.aspx$/i.test(url.pathname);
});
const mediaUrl = z.string().max(2000).refine(value => {
  if (/^\/(?:media|images|uploads)\//.test(value)) return !/[\\\r\n]|(?:^|\/)\.\.(?:\/|$)/.test(value);
  const url = URL.parse(value);
  return url?.protocol === "https:" && !url.username && !url.password;
});
const product = z.object({
  reference: code, name: z.string().min(1).max(500), description: z.string().max(15000).optional(),
  sourceUrl: supplierUrl, images: z.array(mediaUrl).max(60),
  documents: z.array(z.object({ name: z.string().min(1).max(500), url: mediaUrl, type: z.enum(["TECHNICAL_SHEET", "OTHER"]) }).strict()).max(60),
  features: z.array(z.object({ label: z.string().min(1).max(250), value: z.string().min(1).max(1000) }).strict()).max(100),
  weightKg: z.number().positive().max(100_000),
  purchaseObservation: z.object({ amountHT: money, readAt: date }).strict(),
  expectedSaleHT: money,
}).strict();
const family = z.object({
  familyCode: code, name: z.string().min(1).max(500), approvedCategoryId: z.string().min(1).max(80),
  sourceUrl: supplierUrl, verifiedAt: date, products: z.array(product).min(1).max(200),
  excluded: z.array(z.object({
    reference: code, role: z.enum(["OPTION", "ACCESSORY"]), evidence: z.string().trim().min(1).max(500),
  }).strict()).max(200),
}).strict();
export const maintenanceManifest = z.object({
  scopeVersion: z.literal(SCOPE_VERSION), families: z.array(family).min(1).max(100),
  registry: stockmanReplacementsSchema.min(1).max(100),
}).strict();
const operation = z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/);
const approvalSchema = z.object({ operation, manifestSha256: digest, expiresAt: date }).strict();
export const maintenanceRequest = z.discriminatedUnion("action", [
  z.object({ action: z.literal("preview"), operation, manifest: maintenanceManifest }).strict(),
  z.object({ action: z.literal("apply"), operation, manifest: maintenanceManifest, preview: digest,
    confirmation: z.literal("APPLY_STOCKMAN_MAINTENANCE") }).strict(),
  z.object({ action: z.literal("rollback"), operation, confirmation: z.literal("ROLLBACK_STOCKMAN_MAINTENANCE") }).strict(),
]);

export type MaintenanceRequest = z.infer<typeof maintenanceRequest>;
type Manifest = z.infer<typeof maintenanceManifest>;
type Setting = { key: string; value: Prisma.JsonValue; isPublic: boolean };
type Transaction = Prisma.TransactionClient;
type Backup = { before: Setting[]; afterHash: string; references: string[]; manifestSha256: string };

function ordered(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(ordered);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, item]) => [key, ordered(item)]));
  }
  return value;
}

export function maintenanceDigest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(ordered(value))).digest("hex");
}

function reject(code: string, message: string): never {
  throw new ResolutionError(code, message, 409);
}

function authorization(request: MaintenanceRequest) {
  let config: unknown;
  try { config = JSON.parse(process.env.STOCKMAN_MAINTENANCE_APPROVAL ?? "null"); } catch { config = null; }
  const { data } = approvalSchema.safeParse(config);
  if (!data || data.operation !== request.operation || Date.parse(data.expiresAt) <= Date.now()) {
    throw new ResolutionError("MAINTENANCE_DISABLED", "Aucune autorisation de maintenance active pour ce lot.", 423);
  }
  if ("manifest" in request && maintenanceDigest(request.manifest) !== data.manifestSha256) {
    reject("MANIFEST_NOT_APPROVED", "Le manifeste ne correspond pas à l’empreinte autorisée.");
  }
  return data;
}

const pagePath = (value: string) => decodeURIComponent(new URL(value).pathname).replace(/^\/(?:fr|en)\//i, "/").toUpperCase();

export function planMaintenance(manifest: Manifest, current: Inventory, now: number) {
  const parents = manifest.families.map(item => item.familyCode);
  const references = manifest.families.flatMap(item => item.products.map(p => p.reference));
  const excluded = new Set(manifest.families.flatMap(item => item.excluded.map(row => row.reference)));
  const holds = new Set([...(current.replacementHolds ?? []), ...manifest.registry.map(row => row.formerReference.toUpperCase())]);
  const scopedRows = catalogue.products.filter(inCommercialScope);
  const scope = new Set(scopedRows.map(row => row.reference));
  const selected = new Set(references);
  if (new Set(parents).size !== parents.length || selected.size !== references.length) {
    reject("DUPLICATE_MANIFEST_REFERENCE", "Le manifeste contient un parent ou une variante en doublon.");
  }
  if ([...parents, ...references].some(ref => holds.has(ref) || excluded.has(ref)) || references.some(ref => !scope.has(ref))) {
    reject("MANIFEST_REFERENCE_BLOCKED", "Une référence est hors périmètre, ancienne, ou identifiée comme option ou accessoire.");
  }
  const evidence: Evidence[] = manifest.families.map(item => {
    const source = pagePath(item.sourceUrl);
    if (!source.endsWith("--" + item.familyCode + ".ASPX") ||
        new Set(item.excluded.map(row => row.reference)).size !== item.excluded.length ||
        item.products.some(p => pagePath(p.sourceUrl) !== source)) {
      reject("SUPPLIER_EVIDENCE_MISMATCH", "Les provenances ou les rôles fournisseur sont incohérents.");
    }
    const age = now - Date.parse(item.verifiedAt);
    if (age < 0 || age > 30 * day) reject("STALE_SUPPLIER_EVIDENCE", "Une preuve fournisseur est hors période de validité.");
    return {
      familyCode: item.familyCode, name: item.name, approvedCategoryId: item.approvedCategoryId, verifiedAt: item.verifiedAt,
      products: item.products.map(({ expectedSaleHT, ...p }) => {
        const age = now - Date.parse(p.purchaseObservation.readAt);
        if (age < 0 || age >= day) reject("STALE_PURCHASE_OBSERVATION", "Un achat fournisseur est périmé ou daté dans le futur.");
        const salePriceHT = current.prices.get(p.reference) ?? null;
        if (salePriceHT !== expectedSaleHT) reject("SALE_PRICE_CHANGED", "Un prix de vente Neon diffère du manifeste.");
        if (auditStockmanMargin({ salePriceHT, purchasePriceHT: p.purchaseObservation.amountHT }).status !== "meets_reference") {
          reject("MARGIN_BELOW_REFERENCE", "La marge d’une référence est inférieure au seuil OYSTE.");
        }
        return { ...p, stock: null, readAt: null };
      }),
    };
  });
  const existingEvidence = current.evidence.flatMap(item => {
    if (parents.includes(item.familyCode)) {
      if (item.products.some(p => !selected.has(p.reference) && !excluded.has(p.reference))) {
        reject("OTHER_EVIDENCE_AFFECTED", "Le lot modifierait une preuve contenant une référence non autorisée.");
      }
      return [];
    }
    if (item.products.some(p => selected.has(p.reference))) {
      reject("OTHER_EVIDENCE_AFFECTED", "Une référence appartient déjà à une autre preuve de famille.");
    }
    return [item];
  });
  const selection = evidence.map(item => ({
    parent: item.familyCode, categoryId: item.approvedCategoryId!, references: item.products.map(p => p.reference),
  }));
  const plan = planGlobal(scopedRows, { ...current, replacementHolds: holds, evidence: [...existingEvidence, ...evidence] });
  const picked = selectApprovedStockmanGroups(plan.groups, selection);
  if (picked.unavailable.length) reject("MAINTENANCE_PLAN_BLOCKED", "Le planificateur refuse les familles suivantes : " + picked.unavailable.join(", "));
  return { evidence, references, parents, excluded: excluded.size };
}

const readSettings = (tx: Transaction) => tx.siteSetting.findMany({
  where: { key: { in: keys } }, orderBy: { key: "asc" }, select: { key: true, value: true, isPublic: true },
});
const writeSetting = (tx: Transaction, key: string, value: Prisma.InputJsonValue) => tx.siteSetting.upsert({
  where: { key }, create: { key, value, isPublic: false }, update: { value, isPublic: false },
});

export async function maintainStockman(request: MaintenanceRequest, actorId: string) {
  const approval = authorization(request);
  return prisma.$transaction(async tx => {
    if (request.action === "preview") {
      await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
    } else {
      await tx.$executeRawUnsafe("SET LOCAL lock_timeout = '5s'");
      await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(193701, 5)");
      await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(193701, 7)");
      await tx.$executeRawUnsafe('LOCK TABLE "Product", "ProductVariant", "StockmanImportDraft", "Supplier", "Category", "StockmanCatalogReference", "StockmanSalePrice", "AuditLog" IN SHARE ROW EXCLUSIVE MODE');
    }
    const audits = await tx.auditLog.findMany({
      where: { entityType, entityId: request.operation, action: { in: [appliedAction, rollbackAction] } },
      select: { id: true, action: true, metadata: true },
    });
    const applied = audits.find(row => row.action === appliedAction);
    const restored = audits.some(row => row.action === rollbackAction);
    const before = await readSettings(tx);
    if (before.some(row => row.isPublic)) reject("PUBLIC_MAINTENANCE_STATE", "Le stockage concerné doit être privé.");
    const beforeHash = maintenanceDigest(before);
    if (applied) {
      const saved = applied.metadata as unknown as Backup;
      if (saved.manifestSha256 !== approval.manifestSha256) reject("MAINTENANCE_ID_USED", "Cet identifiant est déjà lié à un autre manifeste.");
      if (request.action === "rollback") {
        if (restored) return { status: "already-rolled-back", auditId: applied.id };
        if (saved.afterHash !== beforeHash) reject("MAINTENANCE_CHANGED", "Le stockage a changé depuis la maintenance.");
        const runs = await tx.auditLog.findMany({ where: { action: "STOCKMAN_V297_RUN" }, select: { metadata: true } });
        const references = new Set(saved.references);
        if (runs.some(run => (run.metadata as unknown as { groups?: { products: { reference: string }[] }[] })
          ?.groups?.some(group => group.products.some(p => references.has(p.reference))))) {
          reject("MAINTENANCE_IMPORT_DEPENDENCY", "Un import dépend de ces preuves. Une restauration distincte est requise.");
        }
        for (const key of keys) {
          const previous = saved.before.find(row => row.key === key);
          if (previous) await writeSetting(tx, key, previous.value as Prisma.InputJsonValue);
          else await tx.siteSetting.deleteMany({ where: { key } });
        }
        const audit = await tx.auditLog.create({ data: {
          userId: actorId, action: rollbackAction, entityType, entityId: request.operation,
          metadata: { appliedAuditId: applied.id, beforeHash, restoredHash: maintenanceDigest(saved.before) },
        } });
        return { status: "rolled-back", auditId: audit.id };
      }
      if (restored || saved.afterHash !== beforeHash) reject("MAINTENANCE_ID_USED", "L’autorisation a déjà été consommée.");
      return { status: "already-applied", auditId: applied.id };
    }
    if (request.action === "rollback") reject("MAINTENANCE_NOT_FOUND", "Aucune maintenance correspondante à restaurer.");

    const state = await readImportState(tx);
    if (state.lease && state.lease.expiresAt > Date.now()) reject("RESOLUTION_BUSY", "Une autre vérification est en cours.");
    const registry = before.find(row => row.key === stockmanReplacementSetting);
    const registryPlan = planStockmanReplacements(registry ? stockmanReplacementsSchema.parse(registry.value) : [], request.manifest.registry);
    const plan = planMaintenance(request.manifest, await inventory(tx), Date.now());
    const secret = process.env.AUTH_SECRET;
    if (!secret) throw new ResolutionError("MAINTENANCE_DISABLED", "La signature de la simulation est indisponible.", 423);
    const preview = createHmac("sha256", secret).update("stockman-maintenance-preview\0").update(JSON.stringify({
      actorId, operation: request.operation, manifestSha256: approval.manifestSha256, beforeHash,
    })).digest("hex");
    const summary = { parents: plan.parents.length, references: plan.references.length, excluded: plan.excluded, registry: registryPlan.value.length };
    if (request.action === "preview") return { status: "preview", preview, ...summary };
    if (request.preview !== preview) reject("MAINTENANCE_PREVIEW_CHANGED", "Relancez la simulation avant d’appliquer.");
    const result = await writeStockmanReplacementPlan(tx, registryPlan, actorId);
    const next = { ...state, evidence: [...state.evidence.filter(item => !plan.parents.includes(item.familyCode)), ...plan.evidence], lease: null };
    await writeSetting(tx, importStateKey, next);
    const audit = await tx.auditLog.create({ data: {
      userId: actorId, action: appliedAction, entityType, entityId: request.operation,
      metadata: {
        before, beforeHash, afterHash: maintenanceDigest(await readSettings(tx)), references: plan.references,
        families: plan.parents, manifestSha256: approval.manifestSha256,
        excluded: request.manifest.families.flatMap(item => item.excluded.map(row => row.reference)), registry: result,
      },
    } });
    return { status: "applied", auditId: audit.id, ...summary, registryChanges: result };
  }, { isolationLevel: request.action === "preview" ? "RepeatableRead" : "ReadCommitted", timeout: 25000 });
}
