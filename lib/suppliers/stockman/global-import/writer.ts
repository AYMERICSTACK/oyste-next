import { readFile } from "node:fs/promises";
import path from "node:path";
import { inCommercialScope } from "./scope";
import type { RecordRow } from "./planner";
import { isBlockedStockmanReference } from "../order-policy";
import { randomUUID } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { groupSlug, type Group } from "./planner";
export const IMPORT_INCLUDE={variants:{include:{features:true},orderBy:{code:"asc" as const}},media:{orderBy:{sortOrder:"asc" as const}},documents:{orderBy:{sortOrder:"asc" as const}},features:true};
export async function createDraftGroup(tx:Prisma.TransactionClient,group:Group,supplierId:string,prices:Map<string,number>,runId:string,productId=randomUUID()){
 if(isBlockedStockmanReference(group.key)||group.products.some(p=>isBlockedStockmanReference(p.reference))||new Set(group.products.map(p=>p.reference)).size!==group.products.length)throw Error("Référence arrêtée ou doublon interne.");
 if(group.key.trim().toUpperCase()==="BC")throw Error("Famille BC hors périmètre commercial.");
 const catalog=JSON.parse((await readFile(path.join(process.cwd(),"data/stockman/catalogue-produits.json"),"utf8")).replace(/^\uFEFF/,"")).products as RecordRow[];
 const allowed=new Set(catalog.filter(inCommercialScope).map(r=>r.reference));
 if(group.products.some(p=>!allowed.has(p.reference)))throw Error("Référence hors périmètre commercial : création refusée.");
 const price=(reference:string)=>{const p=prices.get(reference);return p!==undefined&&Number.isFinite(p)&&p>0?p:0;};
 const values=group.products.map(p=>price(p.reference)).filter(p=>p>0);
 if(!group.products.length||group.products.length>200)throw Error("Taille de famille hors limite automatique.");
 const images=[...new Set(group.products.flatMap(p=>p.images))];
 const documents=[...new Map(group.products.flatMap(p=>p.documents).map(d=>[d.url,d])).values()];
 const created=await tx.product.create({data:{id:productId,code:group.key,supplierCode:null,parentCode:group.key,slug:groupSlug(group.key),name:group.name,supplierId,categoryId:group.categoryId,publicationStatus:"DRAFT",shippingMode:"QUOTE",priceHt:values.length?Math.min(...values):0,minPriceHt:values.length?Math.min(...values):0,maxPriceHt:values.length?Math.max(...values):0,stock:0,leadTime:"Disponibilité et transport à confirmer",optionSchema:group.key==="BC"&&group.products.every(p=>p.features.some(f=>/^(capacit|cmu)/i.test(f.label)))?[{label:"Capacité",values:group.products.map(p=>p.features.find(f=>/^(capacit|cmu)/i.test(f.label))!.value)}]:[{label:"Référence",values:group.products.map(p=>p.reference)}],sourceData:{v297:{runId,groupKey:group.key},stockman:{stock:null,stockOnRequest:true,stockReadAt:null,salePriceSource:"RANGE_FROM_NEON_VARIANTS",priceOnRequest:values.length===0,freightIncludedValidated:false}},
 media:{create:images.map((url,i)=>({url,sourceUrl:url,type:"IMAGE",sortOrder:i,isPrimary:i===0}))},documents:{create:documents.map((d,i)=>({...d,sourceUrl:d.url,isPublic:true,sortOrder:i}))},
 variants:{create:group.products.map(p=>{const fresh=!!p.readAt&&Date.parse(p.readAt)<=Date.now()&&Date.now()-Date.parse(p.readAt)<86400000;const stock=fresh&&Number.isSafeInteger(p.stock)&&p.stock!>=0?p.stock:null;return{id:randomUUID(),code:p.reference,supplierCode:p.reference,name:p.name,label:p.name,priceHt:price(p.reference),stock:stock??0,weightKg:p.weightKg!==null&&Number.isFinite(p.weightKg)&&p.weightKg>0?p.weightKg:null,shippingMode:"QUOTE",imageReference:p.reference,options:{Référence:p.reference,...Object.fromEntries(p.features.filter(f=>/^(capacit|cmu)/i.test(f.label)).map(f=>[f.label,f.value]))},sourceData:{v297:{runId},stockman:{reference:p.reference,salePriceSource:"StockmanSalePrice",salePriceReadAt:new Date().toISOString(),priceOnRequest:price(p.reference)===0,sourceUrl:p.sourceUrl,stock,stockOnRequest:stock===null,stockReadAt:p.readAt,images:p.images,freightIncludedValidated:false}},features:{create:p.features}};})}
 },include:IMPORT_INCLUDE});
 if(created.variants.length!==group.products.length||created.variants.some(v=>!group.products.some(p=>p.reference===v.code)))throw Error("Famille créée incomplète.");
 return created;
}
