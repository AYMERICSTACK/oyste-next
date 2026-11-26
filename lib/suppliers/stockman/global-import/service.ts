import { acquireImportLease, readImportState } from "./state";
import { ResolutionError } from "./runtime-errors";
import { pageQueue, pageUrl, retryablePage } from "./page-queue";
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
import { selectApprovedStockmanGroups, type ApprovedStockmanSelection } from "./approved-selection";
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
 tx.stockmanImportDraft.findMany({select:{reference:true}}),tx.stockmanCatalogReference.findMany({where:{isActive:true},select:{reference:true,sourceUrl:true}}),
 tx.category.findMany({select:{id:true,name:true,slug:true,path:true,isActive:true,catalogueVisible:true,parentId:true}}),
 tx.$queryRaw<Array<{reference:string;priceHt:unknown}>>`SELECT "reference", "priceHt" FROM "StockmanSalePrice"`,persistedDiscoveryEvidence(tx)
 ]);
 const cachedEvidence=evidence(await readImportState(tx));
 const replacementHolds=await readStockmanReplacementHolds(tx);
 const sourceRef=(v:unknown)=>{const s=v as {stockman?:{reference?:unknown}}|null;return typeof s?.stockman?.reference==="string"?s.stockman.reference:"";};
 return{replacementHolds,excludedScopeReferences:(await allCatalogue()).filter(r=>!inCommercialScope(r)).map(r=>r.reference),sourceUrls:Object.fromEntries(active.map(a=>[a.reference,a.sourceUrl])),supplierId:suppliers.length===1?suppliers[0].id:null,existing:[...products.map(p=>({kind:"product" as const,categoryId:p.categoryId,id:p.id,productId:p.id,references:[p.code,p.supplierCode||"",sourceRef(p.sourceData),`slug:${p.slug}`].filter(Boolean),supplierId:p.supplierId,publicationStatus:p.publicationStatus})),...variants.map(v=>({kind:"variant" as const,categoryId:v.product.categoryId,id:v.id,productId:v.productId,references:[v.code,v.supplierCode||"",sourceRef(v.sourceData)].filter(Boolean),supplierId:v.product.supplierId,publicationStatus:v.product.publicationStatus}))],drafts:drafts.map(d=>d.reference),active:active.map(a=>a.reference),categories,prices:new Map(prices.map(p=>[p.reference,Number(p.priceHt)]).filter(([,v])=>Number.isFinite(v)&&Number(v)>0) as Array<[string,number]>),evidence:[...new Map([...discoveryEvidence.filter(d=>!cachedEvidence.some(c=>Date.parse(c.verifiedAt)>=Date.parse(d.verifiedAt)&&c.products.some(p=>d.products.some(n=>n.reference===p.reference)))),...cachedEvidence].sort((a,b)=>Date.parse(a.verifiedAt)-Date.parse(b.verifiedAt)).map(e=>[e.familyCode,e])).values()]};
}
export async function simulate(){return prisma.$transaction(async tx=>{await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");await tx.$executeRawUnsafe("SET LOCAL statement_timeout = '8s'");const rows=await catalogue(),inv=await inventory(tx);const plan=planGlobal(rows,inv),state=await readImportState(tx),failed=state.failures;for(const status of plan.statuses){if(status.status==="BLOCKED"&&status.reasons.some(r=>["GROUPING_REQUIRES_SUPPLIER_EVIDENCE","GROUPING_EVIDENCE_EXPIRED","CONFLICTING_GROUPING"].includes(r))&&failed[status.reference]){status.reasons.push("SUPPLIER_VERIFICATION_FAILED");plan.reasons.SUPPLIER_VERIFICATION_FAILED=(plan.reasons.SUPPLIER_VERIFICATION_FAILED||0)+1;}}const verification=pageQueue(plan.statuses,inv.sourceUrls||{},state.pages);for(const exception of verification.exceptions){const status=plan.statuses.find(s=>s.reference===exception.reference);if(status&&!status.reasons.includes(exception.reason)){status.reasons.push(exception.reason);plan.reasons[exception.reason]=(plan.reasons[exception.reason]||0)+1;}}return {...plan,documentedFamilies:new Set(inv.evidence.filter(e=>e.products.some(p=>rows.some(r=>r.reference===p.reference))).map(e=>e.familyCode)).size,blockedFamilies:new Set(plan.statuses.filter(s=>s.status==="BLOCKED"&&s.groupKey&&inv.evidence.some(e=>e.familyCode.toUpperCase()===s.groupKey)).map(s=>s.groupKey)).size,verification,categoryMappings:plan.groups.map(g=>({family:g.key,categoryId:g.categoryId,resolution:g.categoryResolution})),readyParents:plan.groups.length,readyVariants:plan.groups.reduce((n,g)=>n+g.products.length,0),existingParents:new Set(plan.statuses.filter(s=>s.status==="EXISTING").map(s=>s.groupKey)).size,existingVariants:new Set(inv.existing.filter(e=>e.kind==="variant"&&e.references.some(r=>plan.statuses.some(s=>s.status==="EXISTING"&&s.reference===r.trim().toUpperCase()))).map(e=>e.id)).size,scope:scopeReport(await allCatalogue()),origin:"LIVE_NEON_READ_ONLY",canRollback:writesConfigured()&&process.env.STOCKMAN_V297_ROLLBACK_ENABLED==="true",canApply:writesConfigured()};},{isolationLevel:"RepeatableRead",maxWait:5000,timeout:12000});}
export async function verifyExceptions(references:string[]){
 if(references.length!==1)throw new ResolutionError("INVALID_BATCH","Une page famille par requête ; actualiser le BO puis reprendre.",400);
 const lease=await acquireImportLease();
 try{return await verifyUnlocked(references,lease);}finally{await lease.release();}
}
async function verifyUnlocked(references:string[],lease:Awaited<ReturnType<typeof acquireImportLease>>){
 const plan=await simulate();const allowed=new Set(plan.statuses.filter(s=>s.reasons.some(r=>["GROUPING_REQUIRES_SUPPLIER_EVIDENCE","GROUPING_EVIDENCE_EXPIRED","CONFLICTING_GROUPING"].includes(r))).map(s=>s.reference));
 if(references.some(r=>!allowed.has(r)))throw Error("Seules les exceptions de regroupement peuvent être vérifiées.");
 const sources=plan.verification.queue.filter(p=>p.references.some(r=>references.includes(r))).map(p=>({reference:references.find(r=>p.references.includes(r))!,sourceUrl:p.pageKey}));
 const state=await readImportState();
 const failed=state.failures;const prior=evidence(state),results:Array<{reference:string;ok:boolean;message:string;kind?:"verified"|"review"|"unavailable"|"cached"|"timeout"}>=[];
 const checks=state.pages;const seenUrls=new Set<string>(),checkedThisBatch=new Map<string,import("./page-queue").PageCheck>();
 for(const source of sources){const canonical=pageUrl(source.sourceUrl);if(!canonical){failed[source.reference]=new Date().toISOString();results.push({reference:source.reference,ok:false,kind:"review",message:"URL fournisseur invalide."});continue;}if(seenUrls.has(canonical))continue;seenUrls.add(canonical);const task=plan.verification.queue.find(p=>p.pageKey===canonical);if(checkedThisBatch.has(source.reference))checks[canonical]=checkedThisBatch.get(source.reference)!;if(!retryablePage(checks[canonical])){results.push({reference:source.reference,ok:checks[canonical].status==="verified",kind:checks[canonical].status==="unavailable"?"unavailable":"cached",message:"Page déjà contrôlée ; résultat réutilisé."});continue;}if(!task){results.push({reference:source.reference,ok:false,kind:"review",message:"Page déjà contrôlée : consulter les exceptions."});continue;}let accessed=false;let observed:string[]=[];let reviewReason="";try{
  const url=new URL(source.sourceUrl);if(url.protocol!=="https:"||!["www.stockman.fr","stockman.fr"].includes(url.hostname)||url.username||url.password)throw Error("URL fournisseur invalide");
  const family=await getStockmanCommercialFamily(source.reference,canonical,{timeoutMs:20000});
  accessed=true;observed=family.products.map(p=>p.reference);
  if(family.kind!=="product_page"){
   reviewReason="PAGE_NOT_PRODUCT";
   throw Error("La page fournisseur ne contient pas une famille commerciale vérifiable.");
  }
  if(!task.references.every(reference=>family.products.some(p=>p.reference===reference))){
   reviewReason="REFERENCE_NOT_FOUND_ON_PAGE";
   throw Error("La référence demandée n'est pas dans le tableau fournisseur.");
  }
  const products=family.products.filter(p=>p.relationType==="PRIMARY"||p.relationType==="PRIMARY_VARIANT");
  if(!task.references.every(reference=>products.some(p=>p.reference===reference))||family.products.some(p=>p.relationType==="UNKNOWN")){
   reviewReason="ONLY_ACCESSORY_OR_UNCERTAIN_RELATION";
   throw Error("Ligne trouvée mais relation parent/variante non prouvée.");
  }
  if(!family.familyReference){reviewReason="MISSING_FAMILY_ID";throw Error("Identifiant de famille fournisseur absent.");}
  const next:Evidence={name:family.familyDesignation,familyCode:family.familyReference,verifiedAt:new Date().toISOString(),products:products.map(p=>({reference:p.reference,name:p.designation,images:(p.images||[]).map(i=>i.url),documents:(p.documents||[]).map(d=>({name:d.name,url:d.url,type:d.type==="TECHNICAL_SHEET"?"TECHNICAL_SHEET":"OTHER"})),features:(p.features||[]).filter(f=>!/prix|tarif|achat|marge|remise/i.test(f.label)),stock:p.stockOnRequest?null:p.stock,readAt:p.readAt,sourceUrl:p.sourceUrl,weightKg:p.weightKg}))};
  checks[canonical]={canonicalPage:pageUrl(family.pageUrl||family.sourceUrl)||canonical,checkedAt:next.verifiedAt,status:"verified",observedReferences:family.products.map(p=>p.reference),proof:next};
  for(const reference of observed)checkedThisBatch.set(reference,checks[canonical]);
  const redirected=pageUrl(family.pageUrl||family.sourceUrl);if(redirected)checks[redirected]=checks[canonical];
  for(const p of next.products)delete failed[p.reference];for(let i=prior.length-1;i>=0;i--)if(prior[i].familyCode!==next.familyCode&&prior[i].products.some(p=>next.products.some(n=>n.reference===p.reference)))prior.splice(i,1);const index=prior.findIndex(p=>p.familyCode===next.familyCode);if(index>=0)prior[index]=next;else prior.push(next);results.push({reference:source.reference,ok:true,kind:"verified",message:`Famille ${next.familyCode} vérifiée`});
 }catch(error){if(error instanceof ResolutionError && ["NEON_UNAVAILABLE","SESSION_READ_UNAVAILABLE","STOCKMAN_SESSION_MISSING"].includes(error.code))throw error;
  if(classifyStockmanProductReadError(error).errorKind==="authentication") throw new ResolutionError("STOCKMAN_SESSION_EXPIRED", "Session revendeur expirée. Reconnectez-vous avant de reprendre ; aucune preuve enregistrée n’a été modifiée.", 401);
  if((error as {code?:string}).code==="STOCKMAN_READ_TIMEOUT"){results.push({reference:source.reference,ok:false,kind:"timeout",message:"Lecture limitée à 20 secondes ; aucune erreur fournisseur définitive enregistrée. Reprendre cette page."});continue;}const reason=accessed?(reviewReason||"UNCLASSIFIED_FAMILY_REVIEW"):"SUPPLIER_ACCESS_FAILED";
  const previous=checks[canonical];
  checks[canonical]={checkedAt:new Date().toISOString(),status:accessed?"review":"unavailable",observedReferences:observed,reason,attempts:(previous?.attempts??0)+1};for(const reference of task.references)failed[reference]=new Date().toISOString();failed[source.reference]=new Date().toISOString();results.push({reference:source.reference,ok:false,kind:accessed?"review":"unavailable",message:accessed?`Page consultée, famille non validée (${reason}). Reprise automatique différée.`:"Accès fournisseur indisponible ; nouvelle tentative différée."});}}
 for(const reference of references)if(!sources.some(s=>s.reference===reference)){failed[reference]=new Date().toISOString();results.push({reference,ok:false,kind:"review",message:"Référence active ou URL fournisseur absente."});}
 await lease.commit({ pages: checks, failures: failed, evidence: prior });
 return results;
}
function isQaBranch() {
  return process.env.VERCEL_ENV === "preview" && process.env.VERCEL_GIT_COMMIT_REF === "recette-stockman-isolee"
    && process.env.OYSTE_STOCKMAN_TEST === "true";
}
function writesConfigured() {
  return isQaBranch() || (process.env.STOCKMAN_V298_APPLY_APPROVED === "true"
    && process.env.STOCKMAN_V297_IMPORT_ENABLED === "true" && process.env.STOCKMAN_V297_SCOPE_APPROVED === SCOPE_VERSION);
}
async function enabled() {
  if (!writesConfigured()) throw new ResolutionError("COMMERCIAL_WRITES_DISABLED", "L’import réel nécessite une autorisation explicite.", 423);
  if (isQaBranch()) {
    const [marker] = await prisma.$queryRaw<Array<{environment:string}>>`SELECT environment FROM "OysteQaMarker" WHERE environment = 'recette-stockman-isolee'`;
    if (!marker) throw new ResolutionError("COMMERCIAL_WRITES_DISABLED", "Marqueur de recette introuvable.", 423);
  }
}
export async function startRun(actorId?:string, selection?: ApprovedStockmanSelection){
 await enabled();
 const plan=await simulate();
 const groups=selection ? selectApprovedStockmanGroups(plan.groups,selection).accepted : plan.groups;
 if(!groups.length)throw new ResolutionError("NO_READY_GROUP", "Aucune famille prête.", 409);
 const references=new Set(groups.flatMap(group=>group.products.map(product=>product.reference)));
 const expectedPrices=selection?Object.fromEntries(plan.statuses.filter(row=>references.has(row.reference)).map(row=>[row.reference,row.salePriceHT])):null;
 const runId=randomUUID();
 const audit=await prisma.auditLog.create({data:{userId:actorId,action:"STOCKMAN_V297_RUN",entityType:"StockmanImport",entityId:runId,metadata:{scopeVersion:SCOPE_VERSION,runId,groups,expectedPrices,summary:{total:plan.total,ready:groups.reduce((n,g)=>n+g.products.length,0),blocked:plan.blocked},createdAt:new Date().toISOString()}}});
 return {runId:audit.entityId};
}
async function lock(tx:Prisma.TransactionClient){await tx.$executeRawUnsafe("SET LOCAL lock_timeout = '5s'");await tx.$executeRawUnsafe('LOCK TABLE "Product", "ProductVariant", "StockmanImportDraft", "Supplier", "Category", "StockmanCatalogReference", "StockmanSalePrice", "AuditLog" IN SHARE ROW EXCLUSIVE MODE');}
export async function stepRun(runId:string,actorId?:string){await enabled();return prisma.$transaction(async tx=>{
 await lock(tx);const audits=await tx.auditLog.findMany({where:{action:"STOCKMAN_V297_RUN",entityId:runId}});if(audits.length!==1)throw Error("Lot introuvable.");
 const job=audits[0].metadata as unknown as {scopeVersion?:string;groups:Group[];expectedPrices?:Record<string,number|null>|null};if(job.scopeVersion!==SCOPE_VERSION)throw Error("Ancien lot hors périmètre : préparer un nouveau lot sélectionné.");const events=await tx.auditLog.findMany({where:{entityId:runId,action:{in:["STOCKMAN_V297_CREATED","STOCKMAN_V297_BLOCKED","STOCKMAN_V297_ROLLED_BACK"]}}});
 if(events.some(e=>e.action==="STOCKMAN_V297_ROLLED_BACK"))throw Error("Lot en retour arrière : nouvelles créations interdites.");
 const done=new Set(events.map(e=>(e.metadata as {groupKey:string}).groupKey));const group=job.groups.find(g=>!done.has(g.key));if(!group)return {done:true};
 const selected=new Set((await catalogue()).map(r=>r.reference));if(group.products.some(p=>!selected.has(p.reference)))throw Error("Référence hors périmètre sélectionné.");
 const inv=await inventory(tx);inv.evidence=group.key==="BC"?[]:[{name:group.name,familyCode:group.key,verifiedAt:group.verifiedAt||"",products:group.products,approvedCategoryId:group.categoryResolution?.method==="APPROVED_CAPTURED_CATEGORY"?group.categoryId:undefined}];
 if(job.expectedPrices && group.products.some(product=>job.expectedPrices?.[product.reference]!==inv.prices.get(product.reference))){
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
