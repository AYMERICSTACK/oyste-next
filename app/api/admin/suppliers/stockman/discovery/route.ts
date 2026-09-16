import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { getCurrentAdmin } from "@/lib/auth/admin-session";
import { prisma } from "@/lib/db/prisma";
import { getStockmanDiscoveryJob, startStockmanDiscoveryJob } from "@/lib/suppliers/stockman/discovery-jobs";
import { getStockmanProducts } from "@/lib/suppliers/stockman/client";
import { auditStockmanUnresolved } from "@/lib/suppliers/stockman/unresolved-audit";
import { auditStockmanDuplicateStructure } from "@/lib/suppliers/stockman/duplicate-structure-audit";
import { isKnownFalseStockmanReference } from "@/lib/suppliers/stockman/reference-hygiene";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const scanSchema = z.object({
  action: z.literal("scan"),
  seedUrl: z.string().url().optional(),
  maxBrowsePages: z.number().int().min(1).max(500).optional(),
  maxProductPages: z.number().int().min(1).max(2_000).optional(),
});


const prepareImportSchema = z.object({
  action: z.literal("prepare_import"),
  items: z.array(z.object({
    reference: z.string().min(2).max(31),
    designation: z.string().min(1),
    category: z.string().nullable().optional(),
    sourceUrl: z.string().url(),
  })).min(1).max(100),
});

const unresolvedAuditSchema = z.object({
  action: z.literal("audit_unresolved"),
  items: z.array(z.object({
    reference: z.string().min(2).max(31),
    designation: z.string().min(1),
    sourceUrl: z.string().url(),
    category: z.string().nullable(),
    status: z.enum(["matched", "missing", "ambiguous", "already_linked", "suggested"]),
    matchMethod: z.enum(["exact", "normalized", "excel", "suggestion", "none"]),
    confidence: z.number(),
    // V2.12.4.1 — StockmanCatalogMatch exige `reason`. Le client n'a pas
    // besoin de le renvoyer pour cette deuxième passe : Zod fournit une
    // valeur neutre afin de conserver le contrat TypeScript sans changer
    // la logique de l'audit.
    reason: z.string().default("Audit unresolved V2.12.6"),
    missingKind: z.enum(["excel_unmapped", "reference_close", "designation_close", "family_probable", "confirmed_missing"]).optional(),
    catalogueState: z.enum(["present", "to_import", "to_review"]).optional(),
  })).min(1).max(200),
});

const duplicateStructureAuditSchema = z.object({
  action: z.literal("audit_duplicate_structure"),
  references: z.array(z.string().min(2).max(31)).min(1).max(100),
});

const linkSchema = z.object({
  action: z.literal("link"),
  matches: z.array(z.object({
    reference: z.string().min(2).max(31),
    sourceUrl: z.string().url(),
    designation: z.string().min(1),
    targetType: z.enum(["product", "variant"]),
    targetId: z.string().min(1),
    productId: z.string().min(1),
    targetReference: z.string().min(1).max(100),
  })).min(1).max(1_000),
});

async function authorize(write = false) {
  const admin = await getCurrentAdmin();
  if (!admin || admin.status !== "ACTIVE") return NextResponse.json({ message: "Non autorisé." }, { status: 401 });
  if (write && admin.role === "READ_ONLY") return NextResponse.json({ message: "Votre rôle ne permet pas de modifier le catalogue." }, { status: 403 });
  return null;
}

function sourceRecord(value: Prisma.JsonValue | null) {
  return value && typeof value === "object" && !Array.isArray(value) ? { ...(value as Record<string, unknown>) } : {};
}

function linkedSourceData(
  value: Prisma.JsonValue | null,
  match: { reference: string; designation: string; sourceUrl: string; targetReference: string },
): Prisma.InputJsonValue {
  const source = sourceRecord(value);
  const previous = source.stockman && typeof source.stockman === "object" && !Array.isArray(source.stockman)
    ? source.stockman as Record<string, unknown>
    : {};
  return {
    ...source,
    stockman: {
      ...previous,
      reference: match.reference.toUpperCase(),
      targetReference: match.targetReference,
      designation: match.designation,
      sourceUrl: match.sourceUrl,
    },
  } as Prisma.InputJsonValue;
}

export async function GET(request: Request) {
  const denied = await authorize(false);
  if (denied) return denied;

  const url = new URL(request.url);
  if (url.searchParams.get("latest") === "1") {
    const snapshot = await prisma.stockmanCatalogSnapshot.findFirst({ orderBy: { finishedAt: "desc" } });
    if (!snapshot) return NextResponse.json({ restored: false }, { headers: { "Cache-Control": "no-store" } });

    // V2.12.8.2 — le snapshot persistant peut encore contenir des faux
    // tokens issus d'anciens scans. On les purge à la restauration, sans
    // rescanner l'intranet. La règle est centralisée dans reference-hygiene.
    const persistedCandidates = await prisma.stockmanCatalogReference.findMany({
      where: { isActive: true },
      select: { reference: true },
    });
    const ghostReferences = persistedCandidates
      .map((item) => item.reference)
      .filter(isKnownFalseStockmanReference);
    if (ghostReferences.length) {
      await prisma.$transaction([
        prisma.stockmanCatalogReference.deleteMany({ where: { reference: { in: ghostReferences } } }),
        prisma.stockmanImportDraft.deleteMany({ where: { reference: { in: ghostReferences } } }),
      ]);
    }

    const [references, importDrafts] = await Promise.all([
      prisma.stockmanCatalogReference.findMany({ where: { isActive: true }, orderBy: { reference: "asc" } }),
      prisma.stockmanImportDraft.findMany({ where: { status: "PREPARED" }, select: { reference: true } }),
    ]);
    const prepared = new Set(importDrafts.map((item) => item.reference.trim().toUpperCase()));
    const matches = references.map((item) => {
      const status = (item.lastMatchStatus || "missing") as "matched" | "missing" | "ambiguous" | "already_linked" | "suggested";
      const matchMethod = (item.lastMatchMethod || "none") as "exact" | "normalized" | "excel" | "suggestion" | "none";
      const missingKind = item.lastMissingKind as "excel_unmapped" | "reference_close" | "designation_close" | "family_probable" | "confirmed_missing" | null;
      const present = status === "matched" || status === "already_linked";
      return {
        reference: item.reference, designation: item.designation, sourceUrl: item.sourceUrl, category: item.category,
        status, matchMethod, confidence: item.lastConfidence ?? 0,
        reason: "Résultat restauré depuis le dernier référentiel STOCKMAN persistant en base.",
        ...(missingKind ? { missingKind } : {}),
        ...(item.targetType ? { targetType: item.targetType as "product" | "variant" } : {}),
        ...(item.targetId ? { targetId: item.targetId } : {}),
        ...(item.productId ? { productId: item.productId } : {}),
        ...(item.targetReference ? { targetReference: item.targetReference } : {}),
        catalogueState: present ? "present" as const : missingKind === "confirmed_missing" ? "to_import" as const : "to_review" as const,
        importPrepared: prepared.has(item.reference.trim().toUpperCase()),
      };
    });
    const unresolvedItems = matches.filter((item) => item.catalogueState !== "present");
    const unresolvedAudit = unresolvedItems.length ? await auditStockmanUnresolved(unresolvedItems) : null;
    const duplicateRefs = unresolvedAudit?.rows
      .filter((row) => row.decision === "existing" && (row.candidates?.length ?? 0) > 1)
      .map((row) => row.reference) ?? [];
    const duplicateStructureAudit = duplicateRefs.length ? await auditStockmanDuplicateStructure(duplicateRefs) : null;
    const count = (kind: string) => matches.filter((item) => item.missingKind === kind).length;
    const scan = {
      startedAt: snapshot.startedAt.toISOString(), finishedAt: snapshot.finishedAt.toISOString(),
      pagesVisited: snapshot.pagesVisited, productPages: snapshot.productPages,
      diagnostics: { productLinksCollected: 0, uniqueProductUrls: snapshot.productPages, productPageAttempts: snapshot.productPages, productPagesOpened: snapshot.productPages, productPageFailures: 0, productPageRedirects: 0, productPagesWithReferences: 0, productPagesWithoutReferences: 0, extractedOccurrences: references.length, duplicateReferences: 0, extractedFromRows: 0, extractedFromBody: 0, noReferenceSamples: [], failedPageSamples: [], browseQueueRemaining: 0, browseLimitReached: false, productLimitReached: false, scanComplete: true },
      totals: { discovered: matches.length, matched: matches.filter(i => i.status === "matched").length, exact: matches.filter(i => i.matchMethod === "exact" && (i.status === "matched" || i.status === "already_linked")).length, normalized: matches.filter(i => i.matchMethod === "normalized" && (i.status === "matched" || i.status === "already_linked")).length, equivalence: matches.filter(i => i.matchMethod === "excel" && (i.status === "matched" || i.status === "already_linked")).length, suggested: matches.filter(i => i.status === "suggested").length, missing: matches.filter(i => i.status === "missing").length, ambiguous: matches.filter(i => i.status === "ambiguous").length, missingAnalysis: { excelUnmapped: count("excel_unmapped"), referenceClose: count("reference_close"), designationClose: count("designation_close"), familyProbable: count("family_probable"), confirmedMissing: count("confirmed_missing") }, alreadyLinked: matches.filter(i => i.status === "already_linked").length },
      matches, warnings: [`V2.12.8.2 : audit restauré depuis PostgreSQL/Neon sans rescanner l’intranet STOCKMAN. ${ghostReferences.length} référence(s) fantôme(s) purgée(s).`],
      differential: { presentInOyste: matches.filter(i => i.catalogueState === "present").length, toImport: matches.filter(i => i.catalogueState === "to_import").length, toReview: matches.filter(i => i.catalogueState === "to_review").length, disappearedFromStockman: snapshot.disappearedCount, preparedForImport: matches.filter(i => i.importPrepared).length },
    };
    return NextResponse.json({ restored: true, restoredAt: new Date().toISOString(), snapshotFinishedAt: snapshot.finishedAt.toISOString(), ghostReferencesRemoved: ghostReferences, scan, unresolvedAudit, duplicateStructureAudit }, { headers: { "Cache-Control": "no-store" } });
  }

  const jobId = url.searchParams.get("jobId")?.trim();
  if (!jobId) return NextResponse.json({ message: "jobId manquant." }, { status: 400 });

  const job = getStockmanDiscoveryJob(jobId);
  if (!job) return NextResponse.json({ message: "Ce scan n’existe plus ou a expiré." }, { status: 404 });
  return NextResponse.json(job, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const action = body?.action;
  const denied = await authorize(action === "link" || action === "prepare_import");
  if (denied) return denied;

  if (action === "scan") {
    const parsed = scanSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ message: "Paramètres de scan invalides." }, { status: 400 });

    const job = startStockmanDiscoveryJob({
      ...parsed.data,
      // V2.12.3 : le bouton d'audit doit parcourir l'intranet, pas seulement
      // l'échantillon historique limité à 120 pages.
      maxBrowsePages: parsed.data.maxBrowsePages ?? 500,
      maxProductPages: parsed.data.maxProductPages ?? 2_000,
    });
    return NextResponse.json(
      { jobId: job.jobId, status: job.status, progress: job.progress },
      { status: 202, headers: { "Cache-Control": "no-store" } },
    );
  }


  if (action === "audit_unresolved") {
    const parsed = unresolvedAuditSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ message: "Les références à auditer sont invalides." }, { status: 400 });
    }

    const audit = await auditStockmanUnresolved(parsed.data.items);
    return NextResponse.json(audit, {
      headers: { "Cache-Control": "no-store" },
    });
  }

  if (action === "audit_duplicate_structure") {
    const parsed = duplicateStructureAuditSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ message: "Les références à contrôler sont invalides." }, { status: 400 });
    }
    const audit = await auditStockmanDuplicateStructure(parsed.data.references);
    return NextResponse.json(audit, { headers: { "Cache-Control": "no-store" } });
  }

  if (action === "prepare_import") {
    const parsed = prepareImportSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ message: "Les produits à préparer sont invalides." }, { status: 400 });

    const normalized = parsed.data.items.map((item) => ({ ...item, reference: item.reference.trim().toUpperCase() }));
    // V2.12.7 — la résolution finale V2.12.6 fait foi. Une référence peut
    // provenir de l'ancien groupe "à vérifier" : on ne la bloque donc plus
    // sur lastMissingKind. La sécurité réelle est l'absence de référence
    // fournisseur strictement identique dans les produits ET variantes STOCKMAN.
    const supplier = await prisma.supplier.findFirst({
      where: {
        OR: [
          { name: { equals: "STOCKMAN", mode: "insensitive" } },
          { slug: { equals: "stockman", mode: "insensitive" } },
          { code: { equals: "STOCKMAN", mode: "insensitive" } },
        ],
      },
      select: { id: true },
    });
    if (!supplier) return NextResponse.json({ message: "Fournisseur STOCKMAN introuvable." }, { status: 409 });

    const refs = normalized.map((item) => item.reference);
    const [existingProducts, existingVariants] = await Promise.all([
      prisma.product.findMany({
        where: { supplierId: supplier.id, OR: [{ supplierCode: { in: refs } }, { code: { in: refs } }] },
        select: { code: true, supplierCode: true },
      }),
      prisma.productVariant.findMany({
        where: { product: { supplierId: supplier.id }, OR: [{ supplierCode: { in: refs } }, { code: { in: refs } }] },
        select: { code: true, supplierCode: true },
      }),
    ]);
    const existingRefs = new Set(
      [...existingProducts, ...existingVariants]
        .flatMap((item) => [item.supplierCode, item.code])
        .filter((value): value is string => Boolean(value))
        .map((value) => value.trim().toUpperCase()),
    );
    const eligibilityErrors: Array<{ reference: string; message: string }> = [];
    const eligible = normalized.filter((item) => {
      if (existingRefs.has(item.reference)) {
        eligibilityErrors.push({ reference: item.reference, message: "Référence STOCKMAN déjà présente dans OYSTE : import bloqué." });
        return false;
      }
      return true;
    });
    if (!eligible.length) {
      return NextResponse.json({
        message: "Aucune référence sélectionnée n’est encore éligible à l’import.",
        errors: eligibilityErrors,
      }, { status: 409 });
    }

    const liveProducts = await getStockmanProducts(eligible.map((item) => ({ reference: item.reference, productUrl: item.sourceUrl })));
    let prepared = 0;
    const preparedReferences: string[] = [];
    const ignoredGhosts: string[] = [];
    const errors: Array<{ reference: string; message: string }> = [...eligibilityErrors];

    for (let index = 0; index < eligible.length; index += 1) {
      const item = eligible[index];
      const live = liveProducts[index];
      if (!live?.product) {
        const liveError = live?.error || "Lecture Stockman impossible.";
        // V2.12.8.2 — si la fiche s'ouvre mais que le DOM commercial ne
        // contient pas cette référence, il s'agit d'un ancien faux positif du
        // scanner. On le retire du référentiel persistant au lieu de le faire
        // remonter éternellement comme produit à importer.
        if (/n['’]a pas été trouvée sur cette fiche Stockman/i.test(liveError)) {
          await prisma.$transaction([
            prisma.stockmanCatalogReference.deleteMany({ where: { reference: item.reference } }),
            prisma.stockmanImportDraft.deleteMany({ where: { reference: item.reference } }),
          ]);
          ignoredGhosts.push(item.reference);
          continue;
        }
        errors.push({ reference: item.reference, message: liveError });
        continue;
      }
      const product = live.product;
      await prisma.stockmanImportDraft.upsert({
        where: { reference: item.reference },
        create: {
          reference: item.reference,
          designation: product.designation || item.designation,
          category: item.category ?? null,
          sourceUrl: product.sourceUrl,
          purchasePriceExVat: product.purchasePriceExVat,
          stock: product.stockOnRequest ? null : product.stock,
          weightKg: product.weightKg,
          status: "PREPARED",
          sourceReadAt: new Date(product.readAt),
        },
        update: {
          designation: product.designation || item.designation,
          category: item.category ?? null,
          sourceUrl: product.sourceUrl,
          purchasePriceExVat: product.purchasePriceExVat,
          stock: product.stockOnRequest ? null : product.stock,
          weightKg: product.weightKg,
          status: "PREPARED",
          sourceReadAt: new Date(product.readAt),
          preparedAt: new Date(),
        },
      });
      prepared += 1;
      preparedReferences.push(item.reference);
    }

    const preparedTotal = await prisma.stockmanImportDraft.count({ where: { status: "PREPARED" } });
    return NextResponse.json({ prepared, preparedReferences, ignoredGhosts, errors, preparedTotal });
  }

  if (action === "link") {
    const parsed = linkSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ message: "Les associations à enregistrer sont invalides." }, { status: 400 });

    let linked = 0;
    for (const match of parsed.data.matches) {
      if (match.targetType === "product") {
        const product = await prisma.product.findUnique({
          where: { id: match.targetId },
          select: { id: true, supplierCode: true, sourceData: true },
        });
        if (!product || product.id !== match.productId || product.supplierCode?.trim().toUpperCase() !== match.targetReference.trim().toUpperCase()) continue;
        await prisma.product.update({
          where: { id: product.id },
          data: { sourceData: linkedSourceData(product.sourceData, match) },
        });
        linked += 1;
      } else {
        const variant = await prisma.productVariant.findUnique({
          where: { id: match.targetId },
          select: { id: true, productId: true, supplierCode: true, sourceData: true },
        });
        if (!variant || variant.productId !== match.productId || variant.supplierCode?.trim().toUpperCase() !== match.targetReference.trim().toUpperCase()) continue;
        await prisma.productVariant.update({
          where: { id: variant.id },
          data: { sourceData: linkedSourceData(variant.sourceData, match) },
        });
        linked += 1;
      }
    }
    return NextResponse.json({ linked });
  }

  return NextResponse.json({ message: "Action inconnue." }, { status: 400 });
}
