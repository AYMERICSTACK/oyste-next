import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Prisma } from "../generated/prisma/client";
import * as XLSX from "xlsx";
import fs from "node:fs";
import path from "node:path";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL est manquante.");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const APPLY_TOKEN = "APPLY-KITO-25-MARGIN-WEIGHT-ROUTING";
const MARGIN = 0.25;
const DIVISOR = 1 - MARGIN;
const SMALL_PARCEL_MAX_KG = 29;
const PROVISION_COST_HT = 35;

function cleanText(value: unknown) { return String(value ?? "").trim(); }
function normalizeHeader(value: unknown) { return cleanText(value).toLowerCase().replace(/\s+/g, " "); }
function findHeaderIndex(headers: unknown[], candidates: string[]) {
  const normalized = headers.map(normalizeHeader);
  for (const candidate of candidates) { const index = normalized.indexOf(normalizeHeader(candidate)); if (index >= 0) return index; }
  return -1;
}
function findSourceWorkbook() {
  const explicit = process.env.KITO_CATALOGUE_SOURCE_XLSX;
  if (explicit) { const p = path.resolve(explicit); if (!fs.existsSync(p)) throw new Error(`Source KITO introuvable : ${p}`); return p; }
  for (const name of ["Copie de BDD DATAPLUG FINAL (003).xlsx", "Copie de BDD DATAPLUG FINAL (003)(5).xlsx"]) {
    const p = path.resolve(process.cwd(), name); if (fs.existsSync(p)) return p;
  }
  const fallback = fs.readdirSync(process.cwd()).find(name => /dataplug.*\.xlsx$/i.test(name));
  if (fallback) return path.resolve(process.cwd(), fallback);
  throw new Error("Source KITO historique introuvable.");
}
function norm(v: unknown) { return String(v ?? "").trim().toUpperCase(); }
function num(v: unknown) {
  if (v == null || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const normalized = String(v).replace(/\u00a0/g, " ").replace(/\s/g, "").replace(",", ".").replace(/[^0-9.+-]/g, "");
  if (!normalized) return null; const n = Number(normalized); return Number.isFinite(n) ? n : null;
}
function round2(v: number) { return Math.round((v + Number.EPSILON) * 100) / 100; }
function sourceObject(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }

async function main() {
  const apply = process.argv.includes(`--confirm=${APPLY_TOKEN}`);
  console.log("OYSTE — KITO — V2.12.13.11 — marge 25 % + routage poids + provision fournisseur\n");
  console.log(apply ? "Mode : APPLICATION BDD" : "Mode : DRY-RUN — aucune modification BDD");
  console.log("≤29 kg : (PA + 35 €) / 0,75 · KITO→ADEI→client");
  console.log("≥30 kg : PA / 0,75 · direct KITO→client · MESSAGERIE OYSTE");
  console.log("Poids manquant : prix laissé inchangé\n");

  const wb = XLSX.readFile(findSourceWorkbook(), { cellDates: false });
  const sheet = wb.Sheets["KITO"]; if (!sheet) throw new Error("Onglet KITO introuvable.");
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null, blankrows: false, raw: true });
  const headers = rows[0] ?? [];
  const codeIdx = findHeaderIndex(headers, ["Code produit"]);
  const purchaseIdx = findHeaderIndex(headers, ["Prix d'achats", "Prix d’achat", "Prix achat"]);
  if (codeIdx < 0 || purchaseIdx < 0) throw new Error("Colonnes KITO requises introuvables.");
  const byCode = new Map<string, number>();
  for (const row of rows.slice(1)) { const code = norm(row[codeIdx]); const pa = num(row[purchaseIdx]); if (code && pa != null && pa > 0) byCode.set(code, pa); }

  const products = await prisma.product.findMany({
    where: { supplier: { name: { equals: "KITO", mode: "insensitive" } } },
    include: { variants: true },
  });
  const variants = products.flatMap(p => p.variants.map(v => ({ p, v })));
  if (products.length !== 17 || variants.length !== 174) throw new Error(`Sécurité: attendu 17/174, trouvé ${products.length}/${variants.length}.`);

  let small = 0, direct = 0, untouched = 0;
  const updates: Array<{ id: string; priceHt: number; sourceData: Prisma.InputJsonValue }> = [];

  for (const { p, v } of variants) {
    const pa = byCode.get(norm(v.code)); if (!pa) throw new Error(`PA source introuvable pour ${v.code}.`);
    const vw = v.weightKg != null ? Number(v.weightKg) : null;
    const pw = p.weightKg != null ? Number(p.weightKg) : null;
    const weight = vw != null && Number.isFinite(vw) && vw > 0 ? vw : pw != null && Number.isFinite(pw) && pw > 0 ? pw : null;
    const previousSource = sourceObject(v.sourceData);

    if (weight == null) {
      untouched++;
      console.log(`? ${v.code} · PA ${pa.toFixed(2)} € · poids manquant → PRIX INCHANGÉ`);
      if (apply) {
        await prisma.productVariant.update({ where: { id: v.id }, data: { sourceData: { ...previousSource, kitoPurchasePriceHT: round2(pa), kitoBaseRouting: "UNKNOWN", kitoPricingVersion: "V2.12.13.11" } as Prisma.InputJsonValue } });
      }
      continue;
    }

    const isSmall = weight <= SMALL_PARCEL_MAX_KG;
    const provision = isSmall ? PROVISION_COST_HT : 0;
    const price = round2((pa + provision) / DIVISOR);
    if (isSmall) small++; else direct++;
    console.log(`${isSmall ? "≤29" : "≥30"} ${v.code} · ${weight} kg · PA ${pa.toFixed(2)} €${isSmall ? " + 35,00 €" : ""} → PV ${price.toFixed(2)} € HT`);
    updates.push({
      id: v.id,
      priceHt: price,
      sourceData: {
        ...previousSource,
        kitoPurchasePriceHT: round2(pa),
        kitoSupplierFreightProvisionCostHT: provision,
        kitoBaseRouting: isSmall ? "TRANSIT_ADEI" : "DIRECT_KITO",
        kitoMarginOnSellingPrice: MARGIN,
        kitoPricingVersion: "V2.12.13.11",
      } as Prisma.InputJsonValue,
    });
  }

  console.log(`\nRésumé : 174/174 contrôlées · ${small} transit ADEI · ${direct} direct KITO · ${untouched} prix inchangés`);
  if (!apply) {
    console.log(`Aucune donnée modifiée. Pour appliquer : --confirm=${APPLY_TOKEN}`);
    return;
  }

  await prisma.$transaction(async (tx) => {
    for (const update of updates) {
      await tx.productVariant.update({ where: { id: update.id }, data: { priceHt: update.priceHt, sourceData: update.sourceData } });
    }
    // Recalcule les fourchettes parent à partir des variantes après mise à jour.
    for (const product of products) {
      const fresh = await tx.productVariant.findMany({ where: { productId: product.id }, select: { priceHt: true } });
      const prices = fresh.map(x => Number(x.priceHt)).filter(x => Number.isFinite(x) && x > 0);
      if (!prices.length) continue;
      const min = round2(Math.min(...prices)); const max = round2(Math.max(...prices));
      await tx.product.update({ where: { id: product.id }, data: { priceHt: min, minPriceHt: min, maxPriceHt: max } });
    }
  });
  console.log(`Application terminée : ${updates.length} prix variante(s) mis à jour ; ${untouched} prix laissé(s) inchangé(s).`);
}

main().finally(() => prisma.$disconnect());
