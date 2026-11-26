import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getCurrentAdmin } from "@/lib/auth/admin-session";
import { auditStockmanMargin } from "@/lib/suppliers/stockman/margin-audit";
import type { Category, Evidence } from "@/lib/suppliers/stockman/global-import/planner";
import { acquireImportLease, readImportState } from "@/lib/suppliers/stockman/global-import/state";
import { stockmanReplacementsSchema, stockmanReplacementSetting } from "@/lib/suppliers/stockman/reference-replacements";

export const runtime = "nodejs";
export const maxDuration = 60;
const approvedDigest = "19959fed6a86c0aa27cc404dcc5c6896facc1b3246dc8c4fb62d0bd4883f6d73";

type Capture = {
  capturedAt: string;
  categories: Category[];
  families: Array<Omit<Evidence, "products"> & {
    products: Array<Evidence["products"][number] & { expectedSaleHT: number }>;
  }>;
  replacements: unknown;
};

export async function POST(request: Request) {
  if (process.env.VERCEL_ENV !== "preview" || process.env.VERCEL_GIT_COMMIT_REF !== "recette-stockman-isolee"
    || process.env.OYSTE_STOCKMAN_TEST !== "true") return new Response(null, { status: 404 });
  const admin = await getCurrentAdmin();
  if (admin?.status !== "ACTIVE" || admin.role !== "SUPER_ADMIN"
    || request.headers.get("origin") !== new URL(request.url).origin) return new Response(null, { status: 403 });
  if (Number(request.headers.get("content-length")) > 250000) return new Response(null, { status: 413 });
  const content = await request.text();
  if (createHash("sha256").update(content).digest("hex") !== approvedDigest) {
    return NextResponse.json({message:"Le fichier ne correspond pas à la capture autorisée."},{status:400});
  }

  const capture = JSON.parse(content) as Capture;
  const replacements = stockmanReplacementsSchema.parse(capture.replacements);
  const products = capture.families.flatMap(family => family.products);
  const refs = products.map(product => product.reference);
  const [marker] = await prisma.$queryRaw<Array<{environment:string}>>`SELECT environment FROM "OysteQaMarker"`;
  if (marker?.environment !== "recette-stockman-isolee") return new Response(null, { status: 403 });
  if (products.some(product => auditStockmanMargin({
    purchasePriceHT:product.purchaseObservation?.amountHT ?? null, salePriceHT:product.expectedSaleHT,
  }).status !== "meets_reference")) return NextResponse.json({message:"Contrôle de marge non satisfait."},{status:409});

  let lease: Awaited<ReturnType<typeof acquireImportLease>> | undefined;
  try {
    lease = await acquireImportLease();
    const preflight = await prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(193701, 6)`;
      const modifiers = await tx.$queryRaw<Array<{reference:string;priceHt:Prisma.Decimal}>>`
        SELECT reference,"priceHt" FROM "StockmanSalePrice" WHERE reference IN (${Prisma.join(refs)})
      `;
      const current = new Map(modifiers.map(row => [row.reference, Number(row.priceHt)]));
      const mismatches = products.filter(product => current.has(product.reference) &&
        current.get(product.reference) !== product.expectedSaleHT).map(product => product.reference);
      if (mismatches.length) return {mismatches,alreadySeeded:current.size,seeded:0};

      for (const category of capture.categories) {
        const existing = await tx.category.findMany({where:{OR:[{id:category.id},{slug:category.slug}]}});
        if (existing.some(row => row.id !== category.id || row.slug !== category.slug || row.parentId !== category.parentId)) {
          throw new Error("CATEGORY_CHANGED");
        }
        await tx.category.createMany({data:[category],skipDuplicates:true});
      }
      const date = new Date(capture.capturedAt);
      await tx.stockmanCatalogReference.createMany({skipDuplicates:true,data:products.map(product=>({
        reference:product.reference,designation:product.name,sourceUrl:product.sourceUrl,
        firstSeenAt:date,lastSeenAt:date,lastChangedAt:date,
      }))});
      const missing = products.filter(product => !current.has(product.reference));
      if (missing.length) await tx.$executeRaw`
        INSERT INTO "StockmanSalePrice" (reference,"priceHt","sourceVersion","sourceSha256")
        VALUES ${Prisma.join(missing.map(product=>Prisma.sql`(${product.reference},${product.expectedSaleHT},'RECETTE_20261125',${approvedDigest})`))}
        ON CONFLICT (reference) DO NOTHING
      `;
      const saved = await tx.siteSetting.findUnique({where:{key:stockmanReplacementSetting},select:{value:true}});
      if (saved) {
        const present = stockmanReplacementsSchema.parse(saved.value);
        if (JSON.stringify(present) !== JSON.stringify(replacements)) throw new Error("REPLACEMENTS_CHANGED");
      } else {
        await tx.siteSetting.create({data:{key:stockmanReplacementSetting,value:replacements,isPublic:false}});
      }
      return {mismatches,alreadySeeded:current.size,seeded:missing.length};
    },{timeout:25000});
    if (preflight.mismatches.length) return NextResponse.json({message:"Prix de vente recette différents de la capture.",...preflight},{status:409});
    const previous = await readImportState();
    const families = new Set(capture.families.map(family=>family.familyCode));
    const next = capture.families.map(family=>({...family,products:family.products.map(({expectedSaleHT: _,...product})=>product)}));
    await lease.commit({...previous,evidence:[...previous.evidence.filter(family=>!families.has(family.familyCode)),...next]});
    return NextResponse.json({...preflight,referenceReplacements:replacements.length,selection:capture.families.map(family=>({
      parent:family.familyCode,references:family.products.map(product=>product.reference),
    }))});
  } catch (error) {
    const cause = error instanceof Error ? error.message : "";
    return NextResponse.json({message:cause==="CATEGORY_CHANGED"?"Une catégorie de recette diffère du référentiel capturé."
      :cause==="REPLACEMENTS_CHANGED"?"Les décisions de remplacement enregistrées ont changé."
      :"Chargement de la capture refusé. Vérifiez l’état du lot et la disponibilité de Neon."},{status:409});
  } finally {
    await lease?.release();
  }
}
