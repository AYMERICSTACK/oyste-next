import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Prisma } from "../generated/prisma/client";




const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL est manquante.");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const APPLY_TOKEN = "APPLY-KITO-15-FREIGHT-PROVISIONS";
import { kitoSupplierFreightCost } from "../lib/pricing/kito-freight-rules";

const MARGIN = 0.25;
const DIVISOR = 1 - MARGIN;
const SMALL_PARCEL_MAX_KG = 29;

function norm(v: unknown) { return String(v ?? "").trim().toUpperCase(); }
function num(v: unknown) {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function round2(v: number) { return Math.round((v + Number.EPSILON) * 100) / 100; }
function sourceObject(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }

async function main() {
  const apply = process.argv.includes(`--confirm=${APPLY_TOKEN}`);
  console.log("OYSTE — KITO — V2.12.13.15 — marge 25 % + routage poids + provision fournisseur\n");
  console.log(apply ? "Mode : APPLICATION BDD" : "Mode : DRY-RUN — aucune modification BDD");
  console.log("≤29 kg : (PA + port fournisseur selon tranche) / 0,75 · KITO→ADEI→client");
  console.log("≥30 kg : PA / 0,75 · direct KITO→client · MESSAGERIE OYSTE");
  console.log("Poids manquant : prix laissé inchangé\n");

  const products = await prisma.product.findMany({
    where: { supplier: { name: { equals: "KITO", mode: "insensitive" } } },
    include: { variants: true },
  });
  const variants = products.flatMap(p => p.variants.map(v => ({ p, v })));
  const byCode = new Map<string, number>();
  for (const { v } of variants) {
    const pa = num(sourceObject(v.sourceData).kitoPurchasePriceHT);
    if (pa == null || pa <= 0) throw new Error(`PA KITO persistant invalide : ${v.code}`);
    byCode.set(norm(v.code), pa);
  }
  if (products.length !== 17 || variants.length !== 174) throw new Error(`Sécurité: attendu 17/174, trouvé ${products.length}/${variants.length}.`);

  let small = 0, direct = 0, untouched = 0;
  let changed = 0;
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
        await prisma.productVariant.update({ where: { id: v.id }, data: { sourceData: { ...previousSource, kitoPurchasePriceHT: round2(pa), kitoBaseRouting: "UNKNOWN", kitoPricingVersion: "V2.12.13.15" } as Prisma.InputJsonValue } });
      }
      continue;
    }

    const isSmall = weight <= SMALL_PARCEL_MAX_KG;
    const provision = isSmall ? round2(kitoSupplierFreightCost(pa)) : 0;
    const price = round2((pa + provision) / DIVISOR);
    if (isSmall) small++; else direct++;
    console.log(`${isSmall ? "≤29" : "≥30"} ${v.code} · ${weight} kg · PA ${pa.toFixed(2)} €${isSmall ? ` + ${provision.toFixed(2)} €` : ""} → PV ${price.toFixed(2)} € HT`);
    const oldProvision = num(previousSource.kitoSupplierFreightProvisionCostHT) ?? 0;
    const oldPrice = num(v.priceHt) ?? 0;
    if (Math.abs(oldPrice - price) > 0.001 || Math.abs(oldProvision - provision) > 0.001) changed++;
    updates.push({
      id: v.id,
      priceHt: price,
      sourceData: {
        ...previousSource,
        kitoPurchasePriceHT: round2(pa),
        kitoSupplierFreightProvisionCostHT: provision,
        kitoBaseRouting: isSmall ? "TRANSIT_ADEI" : "DIRECT_KITO",
        kitoMarginOnSellingPrice: MARGIN,
        kitoPricingVersion: "V2.12.13.15",
      } as Prisma.InputJsonValue,
    });
  }

  console.log(`\nRésumé : 174/174 contrôlées · ${small} transit ADEI · ${direct} direct KITO · ${untouched} prix inchangés`);
  console.log(`Prix/provisions différents : ${changed}`);
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

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
