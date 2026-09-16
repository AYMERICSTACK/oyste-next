import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getCurrentAdmin } from "@/lib/auth/admin-session";
import type { Prisma } from "@/generated/prisma/client";
import { resolveStockmanCategory } from "@/lib/suppliers/stockman/category";

const VERSION = "V2.12.9";
const EXPECTED_LEAD_TIME_MARKER = "depart usine sous 48 h";
const STOCKMAN_MARGIN_DIVISOR = 0.8;
type JsonObject = Record<string, unknown>;
function normalized(value: string | null | undefined) { return String(value || "").toLocaleLowerCase("fr").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim(); }
function hasStockmanLeadTime(value: string | null | undefined) { return normalized(value).includes(EXPECTED_LEAD_TIME_MARKER); }
function asObject(value: unknown): JsonObject | null { return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : null; }
function stockmanMeta(sourceData: Prisma.JsonValue | null) { return asObject(asObject(sourceData)?.stockman) ?? {}; }
function numberOrNull(value: unknown) { const n = Number(value); return value !== null && value !== undefined && Number.isFinite(n) ? n : null; }
function centsEqual(a: number, b: number) { return Math.abs(Math.round(a * 100) - Math.round(b * 100)) <= 1; }

async function supplierId() {
  return prisma.supplier.findFirst({ where: { OR: [{ name: { equals: "STOCKMAN", mode: "insensitive" } }, { slug: { equals: "stockman", mode: "insensitive" } }] }, select: { id: true, name: true } });
}

async function buildAudit() {
  const supplier = await supplierId(); if (!supplier) return null;
  const products = await prisma.product.findMany({
    where: { supplierId: supplier.id },
    select: {
      id: true, code: true, name: true, description: true, detailedDescription: true, priceHt: true, stock: true, weightKg: true,
      shippingMode: true, leadTime: true, publicationStatus: true, categoryId: true, imageReference: true, sourceData: true,
      category: { select: { name: true, path: true } }, media: { where: { type: "IMAGE" }, select: { id: true }, take: 1 },
      documents: { select: { id: true }, take: 1 }, features: { select: { id: true }, take: 1 },
      variants: { select: { id: true, priceHt: true, shippingMode: true, leadTime: true } },
    }, orderBy: { code: "asc" },
  });
  const rows = products.map((product) => {
    const blockers: string[] = []; const warnings: string[] = []; const meta = stockmanMeta(product.sourceData);
    const purchasePriceHT = numberOrNull(meta.purchasePriceExVat);
    const priceOnRequest = meta.purchasePriceUnavailable === true || purchasePriceHT === null || purchasePriceHT <= 0;
    const stockOnRequest = meta.stockLabel === "Nous consulter" || meta.stock === null;
    const productPriceHT = Number(product.priceHt);
    const expectedSellingPriceHT = purchasePriceHT && purchasePriceHT > 0 ? Math.round((purchasePriceHT / STOCKMAN_MARGIN_DIVISOR) * 100) / 100 : null;
    if (!product.code.trim()) blockers.push("Référence absente");
    if (!product.name.trim()) blockers.push("Nom absent");
    if (!product.categoryId) blockers.push("Catégorie absente");
    if (!product.description?.trim() && !product.detailedDescription?.trim()) blockers.push("Description absente");
    if (!product.media.length && !product.imageReference?.trim()) blockers.push("Image absente");
    if (!product.documents.length) warnings.push("Aucun document technique");
    if (!product.features.length) warnings.push("Aucune caractéristique structurée");
    if (product.weightKg === null || Number(product.weightKg) <= 0) warnings.push("Poids non exploitable / à confirmer");
    if (product.shippingMode !== "INCLUDED") blockers.push("Livraison non incluse");
    if (!hasStockmanLeadTime(product.leadTime)) blockers.push("Délai STOCKMAN non appliqué");
    if (expectedSellingPriceHT !== null) {
      if (!(productPriceHT > 0)) blockers.push("PA disponible mais PV HT nul : vente interdite");
      else if (!centsEqual(productPriceHT, expectedSellingPriceHT)) blockers.push(`PV HT incorrect : attendu ${expectedSellingPriceHT.toFixed(2)} € (PA / 0,80)`);
    } else if (productPriceHT > 0) blockers.push("PV HT présent sans PA STOCKMAN exploitable");
    else warnings.push("Prix STOCKMAN « Nous consulter » : fiche sur devis, jamais vendable à 0 €");
    if (product.variants.some((variant) => variant.shippingMode && variant.shippingMode !== "INCLUDED")) blockers.push("Une variante n’est pas en livraison incluse");
    if (product.variants.some((variant) => variant.leadTime && !hasStockmanLeadTime(variant.leadTime))) blockers.push("Une variante n’a pas le délai STOCKMAN");
    if (product.variants.some((variant) => Number(variant.priceHt) <= 0)) warnings.push("Une ou plusieurs variantes sont « Nous consulter » / sur devis");
    if (stockOnRequest) warnings.push("Stock STOCKMAN « Nous consulter » : disponibilité sur demande");
    const marginRuleValid = expectedSellingPriceHT === null ? productPriceHT === 0 : centsEqual(productPriceHT, expectedSellingPriceHT);
    return { id: product.id, code: product.code, name: product.name, status: product.publicationStatus, importedFromDraft: typeof meta.importedFromDraftAt === "string",
      category: product.category?.path || product.category?.name || null, purchasePriceHT, productPriceHT, expectedSellingPriceHT, marginRuleValid, priceOnRequest,
      stock: product.stock, stockOnRequest, weightKg: product.weightKg === null ? null : Number(product.weightKg), hasImage: Boolean(product.media.length || product.imageReference?.trim()),
      hasDocument: Boolean(product.documents.length), hasFeatures: Boolean(product.features.length), variants: product.variants.length, blockers, warnings, eligible: blockers.length === 0 };
  });
  const draftRows = rows.filter((row) => row.status === "DRAFT");
  return { version: VERSION, supplier, total: rows.length, alreadyPublished: rows.filter((row) => row.status === "PUBLISHED").length, drafts: draftRows.length,
    importedDrafts: draftRows.filter((row) => row.importedFromDraft).length, eligible: draftRows.filter((row) => row.eligible).length, blocked: draftRows.filter((row) => !row.eligible).length,
    missingCategories: draftRows.filter((row) => !row.category).length, zeroPriceSafe: draftRows.filter((row) => row.productPriceHT === 0 && row.priceOnRequest).length,
    pricingErrors: draftRows.filter((row) => !row.marginRuleValid).length, warningCount: draftRows.filter((row) => row.warnings.length > 0).length, rows };
}

async function repairMissingCategories() {
  const supplier = await supplierId(); if (!supplier) return { repaired: 0, unresolved: [] as string[] };
  const products = await prisma.product.findMany({ where: { supplierId: supplier.id, publicationStatus: "DRAFT", categoryId: null }, select: { id: true, code: true, name: true, sourceData: true } });
  let repaired = 0; const unresolved: string[] = [];
  for (const product of products) {
    const meta = stockmanMeta(product.sourceData);
    const resolution = await resolveStockmanCategory({ sourceUrl: typeof meta.sourceUrl === "string" ? meta.sourceUrl : null, designation: product.name, categoryHint: typeof meta.categoryHint === "string" ? meta.categoryHint : null });
    if (!resolution) { unresolved.push(product.code); continue; }
    const root = asObject(product.sourceData) ?? {};
    await prisma.product.update({ where: { id: product.id }, data: { categoryId: resolution.id, sourceData: { ...root, stockman: { ...meta, category: { id: resolution.id, slug: resolution.slug, name: resolution.name, reason: resolution.reason }, categoryFinalizedAt: new Date().toISOString() } } as Prisma.InputJsonValue } });
    repaired += 1;
  }
  return { repaired, unresolved };
}

async function requireAdmin(write = false) {
  const admin = await getCurrentAdmin();
  if (!admin || admin.status !== "ACTIVE") return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  if (write && admin.role === "READ_ONLY") return NextResponse.json({ error: "Votre rôle ne permet pas de modifier le catalogue." }, { status: 403 });
  return null;
}
export async function GET() { const denied = await requireAdmin(false); if (denied) return denied; const audit = await buildAudit(); if (!audit) return NextResponse.json({ error: "Fournisseur STOCKMAN introuvable." }, { status: 404 }); return NextResponse.json(audit); }
export async function POST(request: Request) {
  const denied = await requireAdmin(true); if (denied) return denied; const body = await request.json().catch(() => ({}));
  if (body?.action === "repair_categories") { const result = await repairMissingCategories(); const audit = await buildAudit(); return NextResponse.json({ version: VERSION, ...result, audit, message: `${result.repaired} catégorie(s) STOCKMAN finalisée(s).${result.unresolved.length ? ` ${result.unresolved.length} référence(s) restent à traiter.` : " Les brouillons sont prêts pour l’audit final."}` }); }
  const audit = await buildAudit(); if (!audit) return NextResponse.json({ error: "Fournisseur STOCKMAN introuvable." }, { status: 404 });
  const confirmation = typeof body?.confirmation === "string" ? body.confirmation.trim() : ""; const expected = `PUBLIER STOCKMAN ${audit.eligible}`;
  if (confirmation !== expected) return NextResponse.json({ error: `Confirmation invalide. Tapez exactement ${expected}.` }, { status: 400 });
  const eligibleIds = audit.rows.filter((row) => row.eligible && row.status === "DRAFT").map((row) => row.id);
  if (!eligibleIds.length) return NextResponse.json({ version: VERSION, published: 0, blocked: audit.blocked, message: "Aucune nouvelle fiche STOCKMAN à publier." });
  const result = await prisma.product.updateMany({ where: { id: { in: eligibleIds } }, data: { publicationStatus: "PUBLISHED", publishedAt: new Date() } }); const after = await buildAudit();
  return NextResponse.json({ version: VERSION, published: result.count, blocked: after?.blocked ?? 0, totalPublished: after?.alreadyPublished ?? result.count, message: `${result.count} fiche(s) STOCKMAN publiée(s). ${after?.blocked ?? 0} brouillon(s) restent bloqués par le contrôle final.` });
}
