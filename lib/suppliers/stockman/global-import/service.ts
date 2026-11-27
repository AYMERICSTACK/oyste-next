import { acquireImportLease, readImportState } from "./state";
import { ResolutionError } from "./runtime-errors";
import { pageQueue } from "./page-queue";
import { inCommercialScope, scopeReport, SCOPE_VERSION } from "./scope";
import { hasProvenCompleteStockmanScan } from "../scan-completeness";
import { getImportedProductImagesExact, getImportedProductDocumentsExact } from "@/lib/catalogue/media";
import { createHash, randomUUID } from "node:crypto";

import stockmanCatalogue from "@/data/stockman/catalogue-produits.json";
import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { groupDecision, planGlobal, type Evidence, type Inventory, type RecordRow, type Group } from "./planner";
import { createDraftGroup, IMPORT_INCLUDE } from "./writer";
import { getStockmanCommercialFamily } from "../client";
import { classifyStockmanProductReadError } from "../product-read-error";
import { configuredStockmanSelection, selectApprovedStockmanGroups } from "./approved-selection";
import { auditStockmanMargin } from "../margin-audit";
import { readStockmanReplacementHolds } from "../reference-replacements";
export const hash=(value:unknown)=>createHash("sha256").update(JSON.stringify(value)).digest("hex");
const allCatalogue = () => stockmanCatalogue.products as RecordRow[];
const catalogue = () => allCatalogue().filter(inCommercialScope);
function evidence(state: Awaited<ReturnType<typeof readImportState>>) {
  const proofs = [...state.evidence, ...Object.values(state.pages).flatMap(page => page.proof ? [page.proof] : [])];
  return [...new Map(proofs.sort((a,b) => Date.parse(a.verifiedAt) - Date.parse(b.verifiedAt)).map(item => [item.familyCode, item])).values()];
}
async function persistedDiscoveryEvidence(tx:Prisma.TransactionClient):Promise<Evidence[]>{
 const [job] = await tx.$queryRaw<Array<{ id: string; finishedAt: Date | null; diagnostics: Prisma.JsonValue }>>`
  SELECT id, "finishedAt", diagnostics
  FROM "StockmanDiscoveryJob"
  WHERE status = 'COMPLETE' AND options->'commercialScope' IS NULL
  ORDER BY "finishedAt" DESC NULLS LAST LIMIT 1
 `;
 if(!job?.finishedAt||!job.diagnostics||!hasProvenCompleteStockmanScan(job.diagnostics as Parameters<typeof hasProvenCompleteStockmanScan>[0]))return [];
 const results=await tx.stockmanDiscoveryResult.findMany({where:{jobId:job.id},select:{relationType:true,reference:true,sourceUrl:true,payload:true,updatedAt:true}});
 const local=await catalogue(),families=new Map<string,Evidence>(),blockedFamilies=new Set<string>();
 for(const row of results){const payload=row.payload as {reference?:string;familyReference?:string;familyTitle?:string;classificationConfidence?:string;classificationEvidence?:unknown[];supplierData?:{weightKg?:number|null}};
  if(payload.reference!==row.reference||!payload.familyReference||!["EXPLICIT","STRUCTURAL"].includes(payload.classificationConfidence||"")||!payload.classificationEvidence?.length)continue;
  const record=local.find(r=>r.reference===row.reference);
  if(row.relationType==="UNKNOWN"||(!record&&["PRIMARY","PRIMARY_VARIANT"].includes(row.relationType))){blockedFamilies.add(payload.familyReference);continue;}
  if(!record||!["PRIMARY","PRIMARY_VARIANT"].includes(row.relationType))continue;
  const key=payload.familyReference;let family=families.get(key);if(!family){family={name:payload.familyTitle,familyCode:key,verifiedAt:job.finishedAt.toISOString(),products:[]};families.set(key,family);}
  if(family.products.some(p=>p.reference===row.reference))continue;
  const images=[...new Set([record.imageUrl,...getImportedProductImagesExact(row.reference)].filter(Boolean))];
  const weight=payload.supplierData?.weightKg;
  family.products.push({reference:row.reference,name:record.title,images,documents:getImportedProductDocumentsExact(row.reference).map(d=>({name:d.title,url:d.href,type:"OTHER"})),features:[],stock:null,readAt:null,sourceUrl:row.sourceUrl,weightKg:typeof weight==="number"&&Number.isFinite(weight)&&weight>0?weight:null});
 }
 return [...families.values()].filter(f=>!blockedFamilies.has(f.familyCode));
}
export async function inventory(tx:Prisma.TransactionClient):Promise<Inventory>{
 const [suppliers,products,variants,drafts,active,categories,prices,discoveryEvidence]=await Promise.all([
 tx.supplier.findMany({where:{isActive:true,OR:[{name:{equals:"STOCKMAN",mode:"insensitive"}},{slug:{equals:"stockman",mode:"insensitive"}}]},select:{id:true}}),
 tx.product.findMany({select:{id:true,code:true,supplierCode:true,categoryId:true,parentCode:true,slug:true,sourceData:true,supplierId:true,publicationStatus:true}}),
 tx.productVariant.findMany({select:{id:true,code:true,supplierCode:true,sourceData:true,productId:true,product:{select:{supplierId:true,categoryId:true,publicationStatus:true}}}}),
 tx.stockmanImportDraft.findMany({select:{reference:true}}),tx.stockmanCatalogReference.findMany({where:{isActive:true},select:{reference:true,sourceUrl:true,lastMatchStatus:true,targetId:true,productId:true}}),
 tx.category.findMany({select:{id:true,name:true,slug:true,path:true,isActive:true,catalogueVisible:true,parentId:true}}),
 tx.$queryRaw<Array<{reference:string;priceHt:unknown}>>`SELECT "reference", "priceHt" FROM "StockmanSalePrice"`,persistedDiscoveryEvidence(tx)
 ]);
 const cachedEvidence=evidence(await readImportState(tx));
 const replacementHolds=await readStockmanReplacementHolds(tx);
 const sourceRef=(v:unknown)=>{const s=v as {stockman?:{reference?:unknown}}|null;return typeof s?.stockman?.reference==="string"?s.stockman.reference:"";};
 return{replacementHolds,excludedScopeReferences:(await allCatalogue()).filter(r=>!inCommercialScope(r)).map(r=>r.reference),sourceUrls:Object.fromEntries(active.map(a=>[a.reference,a.sourceUrl])),supplierId:suppliers.length===1?suppliers[0].id:null,existing:[...products.map(p=>({kind:"product" as const,categoryId:p.categoryId,id:p.id,productId:p.id,references:[p.code,p.supplierCode||"",p.parentCode||"",sourceRef(p.sourceData),`slug:${p.slug}`].filter(Boolean),supplierId:p.supplierId,publicationStatus:p.publicationStatus})),...variants.map(v=>({kind:"variant" as const,categoryId:v.product.categoryId,id:v.id,productId:v.productId,references:[v.code,v.supplierCode||"",sourceRef(v.sourceData)].filter(Boolean),supplierId:v.product.supplierId,publicationStatus:v.product.publicationStatus}))],drafts:[...drafts.map(d=>d.reference),...active.filter(a=>a.lastMatchStatus==="ambiguous"||a.targetId||a.productId).map(a=>a.reference)],active:active.map(a=>a.reference),categories,prices:new Map(prices.map(p=>[p.reference,Number(p.priceHt)]).filter(([,v])=>Number.isFinite(v)&&Number(v)>0) as Array<[string,number]>),evidence:[...new Map([...discoveryEvidence.filter(d=>!cachedEvidence.some(c=>Date.parse(c.verifiedAt)>=Date.parse(d.verifiedAt)&&c.products.some(p=>d.products.some(n=>n.reference===p.reference)))),...cachedEvidence].sort((a,b)=>Date.parse(a.verifiedAt)-Date.parse(b.verifiedAt)).map(e=>[e.familyCode,e])).values()]};
}
async function simulateInTransaction(tx: Prisma.TransactionClient) {const rows=await catalogue(),inv=await inventory(tx);const plan=planGlobal(rows,inv),state=await readImportState(tx),failed=state.failures;for(const status of plan.statuses){if(status.status==="BLOCKED"&&status.reasons.some(r=>["GROUPING_REQUIRES_SUPPLIER_EVIDENCE","GROUPING_EVIDENCE_EXPIRED","CONFLICTING_GROUPING"].includes(r))&&failed[status.reference]){status.reasons.push("SUPPLIER_VERIFICATION_FAILED");plan.reasons.SUPPLIER_VERIFICATION_FAILED=(plan.reasons.SUPPLIER_VERIFICATION_FAILED||0)+1;}}const verification=pageQueue(plan.statuses,inv.sourceUrls||{},state.pages);for(const exception of verification.exceptions){const status=plan.statuses.find(s=>s.reference===exception.reference);if(status&&!status.reasons.includes(exception.reason)){status.reasons.push(exception.reason);plan.reasons[exception.reason]=(plan.reasons[exception.reason]||0)+1;}}return {...plan,documentedFamilies:new Set(inv.evidence.filter(e=>e.products.some(p=>rows.some(r=>r.reference===p.reference))).map(e=>e.familyCode)).size,blockedFamilies:new Set(plan.statuses.filter(s=>s.status==="BLOCKED"&&s.groupKey&&inv.evidence.some(e=>e.familyCode.toUpperCase()===s.groupKey)).map(s=>s.groupKey)).size,verification,categoryMappings:plan.groups.map(g=>({family:g.key,categoryId:g.categoryId,resolution:g.categoryResolution})),readyParents:plan.groups.length,readyVariants:plan.groups.reduce((n,g)=>n+g.products.length,0),existingParents:new Set(plan.statuses.filter(s=>s.status==="EXISTING").map(s=>s.groupKey)).size,existingVariants:new Set(inv.existing.filter(e=>e.kind==="variant"&&e.references.some(r=>plan.statuses.some(s=>s.status==="EXISTING"&&s.reference===r.trim().toUpperCase()))).map(e=>e.id)).size,scope:scopeReport(await allCatalogue()),origin:"LIVE_NEON_READ_ONLY",canRollback:writesConfigured()&&process.env.STOCKMAN_V297_ROLLBACK_ENABLED==="true",canVerify:process.env.STOCKMAN_COLLECTIVE_VERIFICATION_AUTHORIZED==="true",approvedFamilies:configuredStockmanSelection().map(group=>({parent:group.parent,references:group.references})),canApply:writesConfigured()};}
export async function simulate(){return prisma.$transaction(async tx=>{await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");await tx.$executeRawUnsafe("SET LOCAL statement_timeout = '8s'");return simulateInTransaction(tx);},{isolationLevel:"RepeatableRead",maxWait:5000,timeout:12000});}
const purchaseMaxAge = 24 * 60 * 60 * 1000;

function purchaseIsUsable(product: Group["products"][number], salePrice: number | undefined) {
  const purchase = product.purchaseObservation;
  if (!purchase) return false;
  const readAt = Date.parse(purchase.readAt);
  const now = Date.now();
  if (!Number.isFinite(readAt) || readAt > now || now - readAt > purchaseMaxAge) return false;
  const margin = auditStockmanMargin({purchasePriceHT:purchase.amountHT, salePriceHT:salePrice ?? null});
  return margin.status !== "missing_data" && margin.status !== "negative";
}

export async function verifyExceptions(references: string[]) {
  if (process.env.STOCKMAN_COLLECTIVE_VERIFICATION_AUTHORIZED !== "true") {
    throw new ResolutionError("VERIFICATION_DISABLED", "L’enregistrement d’une lecture ciblée nécessite une autorisation distincte.", 423);
  }
  const approval = configuredStockmanSelection().find(group => group.references.includes(references[0]));
  if (!approval || references.length !== 1) {
    throw new ResolutionError("INVALID_BATCH", "Choisissez une référence d’une famille autorisée.", 400);
  }
  const lease = await acquireImportLease();
  try {
    const current = await readImportState();
    const inventoryNow = await inventory(prisma);
    const proof = inventoryNow.evidence.find(item => item.familyCode === approval.parent &&
      item.products.length === approval.references.length &&
      item.products.every(p => approval.references.includes(p.reference)));
    const sourceUrl = proof?.products.find(p => p.reference === references[0])?.sourceUrl;
    if (!proof || !sourceUrl) {
      throw new ResolutionError("FAMILY_EVIDENCE_REQUIRED", "Le classement des variantes doit être confirmé avant l’actualisation des tarifs.", 409);
    }
    let reading;
    try {
      reading = await getStockmanCommercialFamily(references[0], sourceUrl);
    } catch (error) {
      if (classifyStockmanProductReadError(error).errorKind === "authentication") {
        throw new ResolutionError("STOCKMAN_SESSION_EXPIRED", "Reconnectez la session revendeur avant de reprendre.", 401);
      }
      throw error;
    }
    const byCode = new Map(reading.products.map(p => [p.reference, p]));
    const trustedHref = (value: string) => new URL(value).pathname.toLowerCase().replace(/^\/(?:fr|en)\//, "/");
    if (reading.kind !== "product_page" || reading.familyReference.toUpperCase() !== approval.parent || trustedHref(reading.pageUrl) !== trustedHref(sourceUrl) ||
        reading.products.length !== approval.references.length || byCode.size !== approval.references.length ||
        proof.products.some(p => {
          const row = byCode.get(p.reference);
          return !row || row.priceOnRequest || !Number.isFinite(row.purchasePriceExVat) || row.purchasePriceExVat <= 0 ||
            !Number.isFinite(Date.parse(row.readAt));
        })) {
      throw new ResolutionError("INCOMPLETE_SUPPLIER_READ", "Lecture incomplète ou configuration différente. Les preuves enregistrées sont conservées.", 409);
    }
    const verifiedAt = new Date().toISOString();
    const next: Evidence = {
      ...proof, verifiedAt, approvedCategoryId: approval.categoryId,
      products: proof.products.map(p => {
        const row = byCode.get(p.reference)!;
        return {...p, stock:null, readAt:null, purchaseObservation:{amountHT:row.purchasePriceExVat, readAt:row.readAt}};
      }),
    };
    await lease.commit({...current, evidence:[...current.evidence.filter(item => item.familyCode !== proof.familyCode),next]});
    return [{reference:references[0], ok:true, kind:"verified", message:"Achat revendeur actualisé pour "+next.familyCode}];
  } finally {
    await lease.release();
  }
}

function writesConfigured() {
  return process.env.STOCKMAN_COLLECTIVE_IMPORT_AUTHORIZED === "true" &&
    process.env.STOCKMAN_V297_SCOPE_APPROVED === SCOPE_VERSION &&
    configuredStockmanSelection().length > 0;
}

function requireWritesConfigured() {
  if (!writesConfigured()) {
    throw new ResolutionError("COMMERCIAL_WRITES_DISABLED", "L’import réel nécessite une autorisation explicite et une liste de familles.", 423);
  }
}

async function enabled(tx: Prisma.TransactionClient = prisma) {
  requireWritesConfigured();
  if ((await readStockmanReplacementHolds(tx)).size < 38) {
    throw new ResolutionError("REPLACEMENT_REGISTRY_REQUIRED", "Le registre des 38 anciens codes doit être confirmé avant l’import.", 423);
  }
}

export async function startRun(actorId?: string) {
  requireWritesConfigured();
  return prisma.$transaction(async tx => {
    await tx.$executeRawUnsafe("SET LOCAL lock_timeout = '5s'");
    await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(193701, 5)");
    await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(193701, 7)");
    await enabled(tx);
    const plan = await simulateInTransaction(tx);
    const approval = configuredStockmanSelection();
    const { accepted: groups, unavailable } = selectApprovedStockmanGroups(plan.groups, approval);
    if (unavailable.length) {
      throw new ResolutionError("APPROVED_FAMILIES_UNAVAILABLE", "Familles autorisées à revoir : "+unavailable.join(", "), 409);
    }
    const references = new Set(groups.flatMap(group => group.products.map(product => product.reference)));
    const expectedPrices = Object.fromEntries(plan.statuses.filter(row => references.has(row.reference)).map(row => [row.reference,row.salePriceHT]));
    const held = groups.filter(group => group.products.some(p => !purchaseIsUsable(p, expectedPrices[p.reference] ?? undefined)));
    if (held.length) {
      throw new ResolutionError("PURCHASE_MARGIN_REVIEW", "Achats récents ou marges à contrôler : "+held.map(group => group.key).join(", "), 409);
    }
    const runId = randomUUID();
    await tx.auditLog.create({data:{userId:actorId,action:"STOCKMAN_V297_RUN",entityType:"StockmanImport",entityId:runId,metadata:{
      scopeVersion:SCOPE_VERSION,runId,groups,expectedPrices,createdAt:new Date().toISOString(),
    }}});
    return {runId};
  }, { isolationLevel: "ReadCommitted", timeout: 25000 });
}

async function lock(tx:Prisma.TransactionClient){await tx.$executeRawUnsafe("SET LOCAL lock_timeout = '5s'");await tx.$executeRawUnsafe('LOCK TABLE "Product", "ProductVariant", "StockmanImportDraft", "Supplier", "Category", "StockmanCatalogReference", "StockmanSalePrice", "AuditLog" IN SHARE ROW EXCLUSIVE MODE');}
export async function stepRun(runId:string,actorId?:string){await enabled();return prisma.$transaction(async tx=>{
 await lock(tx);const audits=await tx.auditLog.findMany({where:{action:"STOCKMAN_V297_RUN",entityId:runId}});if(audits.length!==1)throw Error("Lot introuvable.");
 const job=audits[0].metadata as unknown as {scopeVersion?:string;groups:Group[];expectedPrices?:Record<string,number|null>|null};if(!job.expectedPrices||job.scopeVersion!==SCOPE_VERSION)throw Error("Ancien lot hors périmètre : préparer un nouveau lot sélectionné.");const events=await tx.auditLog.findMany({where:{entityId:runId,action:{in:["STOCKMAN_V297_CREATED","STOCKMAN_V297_BLOCKED","STOCKMAN_V297_ROLLED_BACK"]}}});
 if(events.some(e=>e.action==="STOCKMAN_V297_ROLLED_BACK"))throw Error("Lot en retour arrière : nouvelles créations interdites.");
 const done=new Set(events.map(e=>(e.metadata as {groupKey:string}).groupKey));const group=job.groups.find(g=>!done.has(g.key));if(!group)return {done:true};
 const {accepted}=selectApprovedStockmanGroups([group],configuredStockmanSelection());
 if(!accepted.length)throw new ResolutionError("APPROVED_FAMILY_CHANGED", "Cette famille ne figure plus dans le lot autorisé.", 409);
 const selected=new Set((await catalogue()).map(r=>r.reference));if(group.products.some(p=>!selected.has(p.reference)))throw Error("Référence hors périmètre sélectionné.");
 const inv=await inventory(tx);inv.evidence=group.key==="BC"?[]:[{name:group.name,familyCode:group.key,verifiedAt:group.verifiedAt||"",products:group.products,approvedCategoryId:group.categoryResolution?.method==="APPROVED_CAPTURED_CATEGORY"?group.categoryId:undefined}];
 if(job.expectedPrices && group.products.some(product=>job.expectedPrices?.[product.reference]!==inv.prices.get(product.reference)||!purchaseIsUsable(product,inv.prices.get(product.reference)))){
  await tx.auditLog.create({data:{userId:actorId,entityType:"StockmanImport",entityId:runId,action:"STOCKMAN_V297_BLOCKED",metadata:{groupKey:group.key,reasons:["PRICE_CHANGED_REVIEW_REQUIRED"]}}});
  return {done:false,blocked:group.key};
 }
 const plan=planGlobal(await catalogue(),inv);const current=plan.groups.find(g=>g.key===group.key);
 if(!current){await tx.auditLog.create({data:{userId:actorId,entityType:"StockmanImport",entityId:runId,action:"STOCKMAN_V297_BLOCKED",metadata:{groupKey:group.key,reasons:plan.statuses.filter(s=>s.groupKey===group.key).flatMap(s=>s.reasons)}}});return {done:false,blocked:group.key};}
 if(hash(groupDecision(current))!==hash(groupDecision(group))){await tx.auditLog.create({data:{userId:actorId,entityType:"StockmanImport",entityId:runId,action:"STOCKMAN_V297_BLOCKED",metadata:{groupKey:group.key,reasons:["PLAN_CHANGED_REVIEW_REQUIRED"]}}});return {done:false,blocked:group.key};}
 const stamp={version:"V297",runId,groupKey:group.key,before:current,prices:current.products.map(p=>({reference:p.reference,price:inv.prices.get(p.reference)}))};
 const product=await createDraftGroup(tx,current,inv.supplierId!,inv.prices,runId);
 const audit=await tx.auditLog.create({data:{userId:actorId,entityType:"StockmanImport",entityId:runId,action:"STOCKMAN_V297_CREATED",metadata:{groupKey:group.key,productId:product.id,variantIds:product.variants.map(v=>v.id),backup:stamp,backupHash:hash(stamp),snapshotHash:hash(product),references:current.products.map(p=>p.reference)}}});return {done:false,created:group.key,auditId:audit.id};
 },{isolationLevel:"Serializable",timeout:30000});}
export async function progress(runId?:string){
 const runIds=runId?[runId]:(await prisma.auditLog.findMany({where:{action:"STOCKMAN_V297_RUN"},orderBy:{createdAt:"desc"},take:20})).flatMap(e=>e.entityId?[e.entityId]:[]);
 if(!runIds.length)return [];
 const events=await prisma.auditLog.findMany({where:{entityId:{in:runIds},action:{in:["STOCKMAN_V297_RUN","STOCKMAN_V297_CREATED","STOCKMAN_V297_BLOCKED","STOCKMAN_V297_ROLLED_BACK"]}},orderBy:{createdAt:"desc"}});
 return events.map(e=>{const metadata=e.metadata as unknown as Record<string,unknown>;return {id:e.id,runId:e.entityId,action:e.action,date:e.createdAt,metadata:e.action==="STOCKMAN_V297_RUN"?{...metadata,groups:(metadata.groups as Group[]).map(g=>({key:g.key}))}:Object.fromEntries(Object.entries(metadata).filter(([key])=>key!=="backup"))};});
}
export async function rollbackRun(runId:string,actorId?:string){await enabled();if(process.env.STOCKMAN_V297_ROLLBACK_ENABLED!=="true")throw Error("Retour arrière désactivé : autorisation distincte requise.");return prisma.$transaction(async tx=>{
 await lock(tx);const runs=await tx.auditLog.findMany({where:{action:"STOCKMAN_V297_RUN",entityId:runId}});if(runs.length!==1||(runs[0].metadata as {scopeVersion?:string}).scopeVersion!==SCOPE_VERSION)throw Error("Retour arrière interdit pour un ancien périmètre.");await tx.$executeRawUnsafe('LOCK TABLE "OrderItem", "ProductPresentationOverride" IN SHARE ROW EXCLUSIVE MODE');
 const events=await tx.auditLog.findMany({where:{entityId:runId,action:"STOCKMAN_V297_CREATED"}});
 const restored=await tx.auditLog.findMany({where:{entityId:runId,action:"STOCKMAN_V297_ROLLED_BACK"}});
 const done=new Set(restored.flatMap(e=>(e.metadata as {productIds:string[]}).productIds));
 const event=events.find(e=>!done.has((e.metadata as {productId:string}).productId));
 if(!event)return {done:true,restored:0};
 const meta=event.metadata as {productId:string;snapshotHash:string;groupKey:string};const p=await tx.product.findUnique({where:{id:meta.productId},include:IMPORT_INCLUDE});if(!p||p.publicationStatus!=="DRAFT"||hash(p)!==meta.snapshotHash)throw Error("Famille modifiée : restauration refusée.");
 if(await tx.orderItem.count({where:{OR:[{productId:p.id},{variantId:{in:p.variants.map(v=>v.id)}}]}})||await tx.category.count({where:{representativeProductId:p.id}})||await tx.productPresentationOverride.count({where:{productId:p.id}})||await tx.stockmanCatalogReference.count({where:{OR:[{productId:p.id},{targetId:{in:[p.id,...p.variants.map(v=>v.id)]}}]}}))throw Error("Dépendance détectée : restauration refusée.");
 await tx.product.delete({where:{id:p.id}});
 await tx.auditLog.create({data:{userId:actorId,entityId:runId,entityType:"StockmanImport",action:"STOCKMAN_V297_ROLLED_BACK",metadata:{productIds:[p.id],groupKey:meta.groupKey}}});return {done:false,restored:1};
 },{isolationLevel:"Serializable",timeout:30000});}

export async function resetVerificationFailures() {
  if (process.env.STOCKMAN_COLLECTIVE_VERIFICATION_AUTHORIZED !== "true") {
    throw new ResolutionError("VERIFICATION_DISABLED", "La modification du cache nécessite une autorisation distincte.", 423);
  }
  const lease = await acquireImportLease();
  try {
    const state = await readImportState();
    const pages = Object.fromEntries(Object.entries(state.pages).filter(([,page]) => page.status === "verified"));
    await lease.commit({ pages, failures: {}, evidence: state.evidence });
    return { reset: true };
  } finally {
    await lease.release();
  }
}
