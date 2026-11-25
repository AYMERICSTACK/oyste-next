import { resolveExistingCategory, type CategoryResolution } from "./category-resolution";
import bc from "@/data/stockman/technical-bc.json";
import { BC_CATEGORY, BC_REFERENCES } from "../bc-family-plan";
import { isBlockedStockmanReference } from "../order-policy";
export type RecordRow={reference:string;title:string;category:string;subcategory:string;imageUrl:string};
export type EvidenceProduct={reference:string;name:string;images:string[];documents:Array<{name:string;url:string;type:"TECHNICAL_SHEET"|"OTHER"}>;features:Array<{label:string;value:string}>;stock:number|null;readAt:string|null;sourceUrl:string;weightKg:number|null};
export type Evidence={name?:string;familyCode:string;verifiedAt:string;products:EvidenceProduct[]};
export type Existing={kind?:"product"|"variant";id:string;productId:string;references:string[];supplierId:string|null;publicationStatus:string;categoryId?:string|null};
export type Category={id:string;name:string;slug:string;path:string|null;isActive:boolean;catalogueVisible:boolean;parentId:string|null};
export type Inventory={supplierId:string|null;existing:Existing[];drafts:string[];active:string[];prices:Map<string,number>;categories:Category[];evidence:Evidence[];excludedScopeReferences?:string[];sourceUrls?:Record<string,string>};
export type Group={categoryResolution?:CategoryResolution;verifiedAt?:string;key:string;categoryId:string;name:string;products:EvidenceProduct[]};
export const groupDecision=(g:Group)=>({key:g.key,categoryId:g.categoryId,name:g.name,products:g.products,verifiedAt:g.verifiedAt});
export const groupSlug=(key:string)=>key.toUpperCase()==="BC"?"stockman-griffes-accrochage-bc":`stockman-${key.toLowerCase().replace(/[^a-z0-9]+/g,"-")}`;
const norm=(s:string)=>s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"");
const ref=(s:string)=>s.trim().toUpperCase();
export function planGlobal(rows:RecordRow[],inventory:Inventory){
 const groups:Group[]=[],statuses:Array<{reference:string;status:string;reasons:string[];categoryResolution?:CategoryResolution;groupKey?:string;publicationStatus?:string}>=[];
 const byRef=new Map<string,Evidence[]>();
 for(const evidence of inventory.evidence)for(const product of evidence.products){const r=ref(product.reference);byRef.set(r,[...(byRef.get(r)||[]),evidence]);}
 const bcEvidence:Evidence={familyCode:"BC",verifiedAt:"BC_VALIDATED",products:BC_REFERENCES.map(reference=>({reference,name:rows.find(r=>r.reference===reference)?.title || reference,images:[bc.products[reference as keyof typeof bc.products].imageUrl,...bc.gallery],documents:bc.documents.map(d=>({name:d.title,url:d.url,type:"TECHNICAL_SHEET"})),features:[{label:"Capacité",value:bc.products[reference as keyof typeof bc.products].capacity}],stock:null,readAt:null,sourceUrl:inventory.sourceUrls?.[reference]||"",weightKg:null}))};
 const isVariant=(e:Existing)=>e.kind==="variant"||(e.kind===undefined&&e.id!==e.productId);
 const matchesFor=(r:string)=>{const all=inventory.existing.filter(e=>e.references.map(ref).includes(r));return all.filter(e=>isVariant(e)||!all.some(v=>isVariant(v)&&v.productId===e.productId));};
 const assigned=new Set<string>();
 // Existing references are classified before any family expansion, irrespective of row order.
 for(const row of rows){const r=ref(row.reference),matches=matchesFor(r);if(!matches.length)continue;
  statuses.push({reference:r,status:!isBlockedStockmanReference(r)&&matches.length===1&&inventory.supplierId!==null&&matches[0].supplierId===inventory.supplierId?"EXISTING":"BLOCKED",reasons:!inventory.supplierId?["SUPPLIER_MISSING_OR_AMBIGUOUS"]:isBlockedStockmanReference(r)?["DISCONTINUED"]:matches.length>1?["AMBIGUOUS_IDENTITY"]:matches[0].supplierId!==inventory.supplierId?["OTHER_SUPPLIER_COLLISION"]:[],publicationStatus:matches[0].publicationStatus,groupKey:matches[0].productId});assigned.add(r);}

 for(const row of rows){const r=ref(row.reference);if(assigned.has(r))continue;
  const matches=matchesFor(r);
  if(isBlockedStockmanReference(r)){statuses.push({reference:r,status:"BLOCKED",reasons:["DISCONTINUED"]});assigned.add(r);continue;}
  if(matches.length){statuses.push({reference:r,status:matches.length===1&&inventory.supplierId!==null&&matches[0].supplierId===inventory.supplierId?"EXISTING":"BLOCKED",reasons:!inventory.supplierId?["SUPPLIER_MISSING_OR_AMBIGUOUS"]:matches.length>1?["AMBIGUOUS_IDENTITY"]:matches[0].supplierId!==inventory.supplierId?["OTHER_SUPPLIER_COLLISION"]:[],publicationStatus:matches[0].publicationStatus,groupKey:matches[0].productId});assigned.add(r);continue;}
  if(!inventory.active.includes(r)){statuses.push({reference:r,status:"BLOCKED",reasons:["REFERENCE_NOT_ACTIVE",...(!inventory.prices.has(r)?["NO_NEON_PRICE"]:[])]});assigned.add(r);continue;}
  if(!inventory.prices.has(r)){statuses.push({reference:r,status:"BLOCKED",reasons:["NO_NEON_PRICE"]});assigned.add(r);continue;}
  const proofs=BC_REFERENCES.includes(r)?[bcEvidence]:byRef.get(r)||[];
  if(proofs.length!==1){statuses.push({reference:r,status:"BLOCKED",reasons:[proofs.length?"CONFLICTING_GROUPING":"GROUPING_REQUIRES_SUPPLIER_EVIDENCE",...(!inventory.prices.has(r)?["NO_NEON_PRICE"]:[])]});assigned.add(r);continue;}
  const proof=proofs[0];const candidates=proof.products.filter(p=>rows.some(x=>ref(x.reference)===ref(p.reference))&&!matchesFor(ref(p.reference)).length&&inventory.active.includes(ref(p.reference))&&inventory.prices.has(ref(p.reference))&&!isBlockedStockmanReference(p.reference));
  const reasons:string[]=[];
  const slugKey=`slug:${groupSlug(proof.familyCode)}`;
  if(inventory.existing.some(e=>e.references.includes(slugKey)))reasons.push("PARENT_SLUG_ALREADY_EXISTS");
  if(groups.some(g=>groupSlug(g.key)===groupSlug(proof.familyCode)))reasons.push("AMBIGUOUS_FAMILY_SLUG");
  if(isBlockedStockmanReference(proof.familyCode))reasons.push("DISCONTINUED_FAMILY_KEY");
  if(proof.products.some(p=>!rows.some(x=>ref(x.reference)===ref(p.reference))&&!inventory.excludedScopeReferences?.includes(ref(p.reference))))reasons.push("FAMILY_HAS_OUT_OF_SCOPE_MEMBERS");
  if(new Set(candidates.map(p=>{const row=rows.find(r=>ref(r.reference)===ref(p.reference));return norm(`${row?.category} ${row?.subcategory}`);})).size>1)reasons.push("CONFLICTING_FAMILY_CATEGORIES");
  if(inventory.existing.some(e=>e.references.map(ref).includes(ref(proof.familyCode))))reasons.push("PARENT_IDENTITY_ALREADY_EXISTS");
  if(proof.familyCode==="BC"&&BC_REFERENCES.some((r,i)=>inventory.prices.get(r)!==[70,73.75,110,113.75,188.75][i]))reasons.push("BC_VALIDATED_PRICES_CHANGED");
  if(!inventory.supplierId)reasons.push("SUPPLIER_MISSING_OR_AMBIGUOUS");
  if(new Set(candidates.map(p=>ref(p.reference))).size!==candidates.length)reasons.push("DUPLICATE_SOURCE_REFERENCE");
  if(proof.familyCode!=="BC"&&(!Number.isFinite(Date.parse(proof.verifiedAt))||Date.now()-Date.parse(proof.verifiedAt)>30*86400000||Date.parse(proof.verifiedAt)>Date.now()))reasons.push("GROUPING_EVIDENCE_EXPIRED");
  if(!candidates.length)reasons.push("EMPTY_FAMILY");
  if(candidates.length>200)reasons.push("FAMILY_TOO_LARGE_FOR_AUTOMATIC_BATCH");
  if(candidates.some(p=>isBlockedStockmanReference(p.reference)))reasons.push("FAMILY_CONTAINS_DISCONTINUED_REFERENCE");
  if(proof.products.some(p=>inventory.existing.some(e=>e.references.map(ref).includes(ref(p.reference)))))reasons.push("PARTIALLY_EXISTING_FAMILY_REVIEW_REQUIRED");
  if(candidates.some(p=>inventory.drafts.map(ref).includes(ref(p.reference))))reasons.push("EXISTING_IMPORT_DRAFT_REVIEW_REQUIRED");
  if(candidates.some(p=>!inventory.active.includes(ref(p.reference))))reasons.push("REFERENCE_NOT_ACTIVE");

  const categoryResolution=resolveExistingCategory(row,rows,inventory.categories,inventory.existing.filter(e=>e.supplierId===inventory.supplierId));
  const categories=inventory.categories.filter(c=>c.id===categoryResolution.categoryId);
  if(categories.length!==1)reasons.push("CATEGORY_MISSING_OR_AMBIGUOUS");

  if(proof.familyCode==="BC"&&!inventory.categories.some(c=>c.id===BC_CATEGORY.parentId&&c.isActive))reasons.push("BC_CATEGORY_PARENT_INVALID");
  if(candidates.some(p=>assigned.has(ref(p.reference))))reasons.push("OVERLAPPING_FAMILY");
  const key=proof.familyCode.toUpperCase();
  if(groups.some(g=>g.key===key))reasons.push("DUPLICATE_FAMILY_KEY");
  for(const p of candidates){const reference=ref(p.reference);if(!assigned.has(reference)){statuses.push({reference,categoryResolution,status:reasons.length?"BLOCKED":"READY",reasons:[...new Set([...reasons,...(!inventory.prices.has(reference)?["NO_NEON_PRICE"]:[])])],groupKey:key});assigned.add(reference);}}
  if(!reasons.length)groups.push({categoryResolution,verifiedAt:proof.verifiedAt,key,categoryId:categories[0].id,name:proof.familyCode==="BC"?"Griffes d’accrochage pour palan BC":proof.name||row.title,products:candidates});
 }
 const reasons:Record<string,number>={};for(const s of statuses)for(const r of s.reasons)reasons[r]=(reasons[r]||0)+1;
 return {total:rows.length,drafts:statuses.filter(s=>s.status==="EXISTING"&&s.publicationStatus==="DRAFT").length,existing:statuses.filter(s=>s.status==="EXISTING").length,ready:statuses.filter(s=>s.status==="READY").length,blocked:statuses.filter(s=>s.status==="BLOCKED").length,withoutPrice:rows.filter(r=>!inventory.prices.has(ref(r.reference))).length,reasons,statuses:statuses.map(s=>({...s,salePriceHT:inventory.prices.get(s.reference)??null})),groups};
}
