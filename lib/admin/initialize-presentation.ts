import { Prisma } from "@/generated/prisma/client";
import { legacyCategories, legacySuppliers } from "@/lib/catalogue/presentation-defaults";
import { getProductsByCategory, getProductMediaImages, type CatalogueProduct } from "@/lib/catalogue/repository";
import { editorialDefaults } from "@/lib/editorial-defaults";
// Explicit one-time initialization. Never run by a public request or a supplier synchronization.
export async function initializePresentation(tx: Prisma.TransactionClient, accessProducts: CatalogueProduct[] = [], userId?: string) {
 await tx.$executeRaw`SELECT pg_advisory_xact_lock(728194062)`;
 const ready=await tx.siteSetting.findUnique({where:{key:'cms.catalogue.ready'}});
 if(ready?.value===true)return {alreadyInitialized:true,categories:0,suppliers:0};
 const categories=legacyCategories(accessProducts),ids=new Map<string,string>();
 let categoryCount=0,supplierCount=0;
 for(const snapshot of categories){
  const {id,parentId,homeParentId,...value}=snapshot;
  const existing=await tx.category.findUnique({where:{slug:value.slug}});
  const presentationParent=homeParentId ? ids.get(homeParentId) || null : null;
  if(existing?.presentationConfigured){ids.set(id,existing.id);continue;}
  const data={...value,homeParentId:presentationParent,presentationConfigured:true};
  const item=existing?await tx.category.update({where:{id:existing.id},data:{...data,name:existing.name,description:existing.description || value.description,seoTitle:existing.seoTitle,seoDescription:existing.seoDescription,imageUrl:existing.imageUrl || value.imageUrl,isActive:existing.isActive,sortOrder:existing.sortOrder || value.sortOrder}}):await tx.category.create({data});
  ids.set(id,item.id);categoryCount++;
 }
 // Materialize the two existing configurator landing products for commercial BO management.
 for(const product of getProductsByCategory('levage').filter(item=>item.id.startsWith('virtual-'))){
  if(await tx.product.findUnique({where:{slug:product.slug}}))continue;
  const media=getProductMediaImages(product);
  await tx.product.create({data:{id:product.id,code:product.code,supplierCode:product.supplierCode,parentCode:product.parentCode,sortOrder:1000000,marketingBadges:product.marketingBadges || [],slug:product.slug,name:product.name,shortName:product.shortName,description:product.description,detailedDescription:product.detailedDescription,priceHt:product.priceHT || 0,stock:product.stock || 0,leadTime:product.delay,imageReference:product.imageRef,publicationStatus:'PUBLISHED',experienceType:product.experienceType || 'CONFIGURABLE',configuratorFamily:product.configuratorFamily,categoryId:ids.get('legacy:levage'),shippingMode:product.shippingMode || 'QUOTE',sourceData:{adminCreated:true,virtualPresentation:true,categories:product.categories,manufacturer:product.manufacturer},features:{create:product.features.map((feature,sortOrder)=>({...feature,sortOrder}))},media:{create:media.map((url,sortOrder)=>({url,type:'IMAGE',sortOrder,isPrimary:sortOrder===0}))}}});
 }
 for(const snapshot of legacySuppliers){
  const {id,...value}=snapshot;
  const existing=await tx.supplier.findFirst({where:{OR:[{slug:value.slug},{name:{equals:value.name,mode:'insensitive'}}]}});
  if(existing?.presentationConfigured)continue;
  // Preserve integration identifiers and names when the supplier already exists.
  const {name,slug,isActive,...presentation}=value;
  if(existing)await tx.supplier.update({where:{id:existing.id},data:{...presentation,presentationConfigured:true}});
  else await tx.supplier.create({data:{...value,presentationConfigured:true}});
  supplierCount++;
 }
 for(const [page,value] of Object.entries(editorialDefaults)){const key=`cms.page.${page}`;await tx.siteSetting.upsert({where:{key},create:{key,value,isPublic:true,description:`Page commerciale ${page}`},update:{}});}
 await tx.siteSetting.upsert({where:{key:'cms.catalogue.ready'},create:{key:'cms.catalogue.ready',value:true,isPublic:false},update:{value:true}});
 await tx.auditLog.create({data:{action:'PRESENTATION_INITIALIZE',entityType:'SiteSetting',entityId:'cms.catalogue.ready',userId,metadata:{categories:categoryCount,suppliers:supplierCount}}});
 return {alreadyInitialized:false,categories:categoryCount,suppliers:supplierCount};
}
