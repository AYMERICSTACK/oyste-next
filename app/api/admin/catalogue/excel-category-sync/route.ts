import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getCurrentAdmin } from "@/lib/auth/admin-session";
import { EXCEL_CATEGORY_REFERENCE, type ExcelCategoryReferenceRow } from "@/lib/admin/excel-category-reference.generated";

type AuditItem = { id:string; code:string; name:string; supplier:string; currentPath:string; targetPath:string; match:"code"|"supplierReference"|"parent+name"|"parent" };
type Unresolved = { id:string; code:string; name:string; supplier:string; reason:string };
const normalized=(v:string|null|undefined)=>String(v||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[’']/g,"'").replace(/\s+/g," ").trim();
const key=(v:string|null|undefined)=>normalized(v).replace(/[^a-z0-9]+/g,"");
const slugify=(v:string)=>normalized(v).replace(/&/g," et ").replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"");
const rowsBySupplier=new Map<string,ExcelCategoryReferenceRow[]>();
for(const row of EXCEL_CATEGORY_REFERENCE){const k=key(row.supplier);rowsBySupplier.set(k,[...(rowsBySupplier.get(k)||[]),row]);}

function resolveExcelCategory(product:{code:string;name:string;supplier:{name:string}|null}){
  if(!product.supplier)return {reason:"Fournisseur absent"} as const;
  const rows=rowsBySupplier.get(key(product.supplier.name));
  if(!rows?.length)return {reason:"Fournisseur absent du référentiel Excel"} as const;
  const productCode=key(product.code);
  const choose=(candidates:ExcelCategoryReferenceRow[],match:AuditItem["match"]): { targetPath: string; match: AuditItem["match"] } | { reason: string }=>{
    const categories=Array.from(new Set(candidates.map(r=>r.categoryPath).filter((value): value is string=>typeof value==="string"&&value.trim().length>0)));
    if(categories.length===1){const targetPath=categories[0];if(targetPath)return {targetPath,match};}
    if(candidates.length>1){const byName=candidates.filter(r=>[r.name,r.fullName].some(n=>normalized(n)===normalized(product.name)));const named=Array.from(new Set(byName.map(r=>r.categoryPath).filter((value): value is string=>typeof value==="string"&&value.trim().length>0)));if(named.length===1){const targetPath=named[0];if(targetPath)return {targetPath,match};}}
    return {reason:`Référence ambiguë dans l’Excel (${categories.length} catégories)`};
  };
  const direct=rows.filter(r=>key(r.productCode)===productCode); if(direct.length)return choose(direct,"code");
  const supplierRef=rows.filter(r=>key(r.supplierReference)===productCode); if(supplierRef.length)return choose(supplierRef,"supplierReference");
  const parents=rows.filter(r=>r.parentCode&&key(r.parentCode)===productCode);
  if(parents.length){const exact=parents.filter(r=>[r.name,r.fullName].some(n=>normalized(n)===normalized(product.name)));if(exact.length)return choose(exact,"parent+name");return choose(parents,"parent");}
  return {reason:"Référence introuvable dans l’Excel"} as const;
}

async function buildAudit(){
  const products=await prisma.product.findMany({select:{id:true,code:true,name:true,supplier:{select:{name:true}},category:{select:{path:true,name:true}}},orderBy:[{supplier:{name:"asc"}},{code:"asc"}]});
  const corrections:AuditItem[]=[];const correct:AuditItem[]=[];const unresolved:Unresolved[]=[];const excludedStockman:Unresolved[]=[];
  for(const product of products){
    if(key(product.supplier?.name)==="stockman"){excludedStockman.push({id:product.id,code:product.code,name:product.name,supplier:product.supplier?.name||"STOCKMAN",reason:"Exclu de l’audit Excel : catégorie pilotée par le breadcrumb Stockman"});continue;}
    const resolved=resolveExcelCategory(product);if(!("targetPath" in resolved)){unresolved.push({id:product.id,code:product.code,name:product.name,supplier:product.supplier?.name||"—",reason:resolved.reason});continue;}const currentPath=product.category?.path||product.category?.name||"Aucune catégorie";const item:AuditItem={id:product.id,code:product.code,name:product.name,supplier:product.supplier?.name||"—",currentPath,targetPath:resolved.targetPath,match:resolved.match};if(normalized(currentPath)===normalized(resolved.targetPath))correct.push(item);else corrections.push(item);}
  return {total:products.length,audited:products.length-excludedStockman.length,excludedStockman,corrections,correct,unresolved};
}

async function ensureCategoryPath(tx:Parameters<Parameters<typeof prisma.$transaction>[0]>[0],requestedPath:string){
  const parts=requestedPath.split("\\").map(p=>p.trim()).filter(Boolean);let parentId:string|null=null;let currentPath="";let finalId="";
  for(const name of parts){currentPath=currentPath?`${currentPath}\\${name}`:name;const existing:{id:string;path:string|null}|null=await tx.category.findFirst({where:{OR:[{path:currentPath},{AND:[{name},{parentId}]}]},select:{id:true,path:true}});if(existing){finalId=existing.id;parentId=existing.id;if(!existing.path)await tx.category.update({where:{id:existing.id},data:{path:currentPath}});continue;}let slug=slugify(currentPath);let suffix=2;while(await tx.category.findUnique({where:{slug},select:{id:true}}))slug=`${slugify(currentPath)}-${suffix++}`;const created:{id:string}=await tx.category.create({data:{name,slug,path:currentPath,parentId,isActive:true},select:{id:true}});finalId=created.id;parentId=created.id;}
  if(!finalId)throw new Error(`Catégorie cible impossible à résoudre : ${requestedPath}`);return finalId;
}

export async function GET(){const admin=await getCurrentAdmin();if(!admin)return NextResponse.json({error:"Non autorisé."},{status:401});const audit=await buildAudit();return NextResponse.json({version:"V2.10.24.1",source:"Copie de BDD DATAPLUG FINAL (003)(4).xlsx",...audit});}
export async function POST(request:Request){
  const admin=await getCurrentAdmin();if(!admin)return NextResponse.json({error:"Non autorisé."},{status:401});if(admin.role==="READ_ONLY")return NextResponse.json({error:"Votre rôle ne permet pas de corriger les catégories."},{status:403});
  const body=await request.json().catch(()=>({}));const expected=Number(body?.expected||0);const audit=await buildAudit();if(!audit.corrections.length)return NextResponse.json({version:"V2.10.24.1",updated:0});if(expected!==audit.corrections.length)return NextResponse.json({error:`L’audit a changé (${audit.corrections.length} correction(s) maintenant). Relancez l’audit avant d’appliquer.`},{status:409});
  try{const updated=await prisma.$transaction(async tx=>{const fresh=await tx.product.findMany({where:{id:{in:audit.corrections.map(i=>i.id)}},select:{id:true,category:{select:{path:true,name:true}}}});const freshById=new Map(fresh.map(p=>[p.id,p]));for(const item of audit.corrections){const p=freshById.get(item.id);const current=p?.category?.path||p?.category?.name||"Aucune catégorie";if(!p||normalized(current)!==normalized(item.currentPath))throw new Error(`ANTI_DRIFT:${item.code}`);}const grouped=new Map<string,string[]>();for(const item of audit.corrections)grouped.set(item.targetPath,[...(grouped.get(item.targetPath)||[]),item.id]);let count=0;for(const [targetPath,ids] of grouped){const categoryId=await ensureCategoryPath(tx,targetPath);const result=await tx.product.updateMany({where:{id:{in:ids}},data:{categoryId}});count+=result.count;}if(count!==audit.corrections.length)throw new Error("UPDATE_COUNT_MISMATCH");return count;},{maxWait:15000,timeout:60000});return NextResponse.json({version:"V2.10.24.1",updated});}
  catch(error){const message=error instanceof Error?error.message:"Correction impossible.";if(message.startsWith("ANTI_DRIFT:"))return NextResponse.json({error:`Le catalogue a changé depuis l’audit (${message.slice(11)}). Relancez l’audit.`},{status:409});throw error;}
}
