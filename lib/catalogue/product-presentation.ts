import { z } from "zod";
import { publicUrlSchema } from "@/lib/cms-validation";
import type { CatalogueProduct, CatalogueVariant } from "./repository";
const text = z.string().max(100000);
const labels = z.array(z.string().trim().min(1).max(250)).max(100);
export const presentationFields = ["experienceType", "configuratorHref", "categoryId", "name", "shortName", "description", "detailedDescription", "seoTitle", "seoDescription", "featured", "sortOrder", "marketingBadges", "faq", "videoUrls", "relatedProductCodes", "accessoryProductCodes", "features", "media", "documents", "variantPresentation"] as const;
export const productPresentationSchema = z.object({
  experienceType:z.enum(["STANDARD","CONFIGURABLE"]).optional(), configuratorHref:publicUrlSchema.optional(),
  categoryId: z.string().min(1).max(200).nullable().optional(),
  name: z.string().trim().min(1).max(250).optional(), shortName: z.string().max(250).optional(),
  description: text.optional(), detailedDescription: text.optional(), seoTitle: z.string().max(250).optional(), seoDescription: z.string().max(10000).optional(),
  featured: z.boolean().optional(), sortOrder: z.number().int().min(0).max(100000).optional(),
  marketingBadges: labels.optional(),
  faq: z.array(z.object({ question: z.string().trim().min(1).max(500), answer: z.string().max(20000) }).strict()).max(100).optional(),
  videoUrls: z.array(publicUrlSchema).max(30).optional(), relatedProductCodes: labels.optional(), accessoryProductCodes: labels.optional(),
  features: z.array(z.object({ label: z.string().trim().min(1).max(250), value: z.string().max(20000) }).strict()).max(200).optional(),
  media: z.array(z.object({ url: publicUrlSchema, altText: z.string().max(500).default(""), isPrimary: z.boolean(), sortOrder: z.number().int().min(0).max(10000), enabled: z.boolean().default(true) }).strict()).max(100).refine(items => items.filter(item => item.enabled && item.isPrimary).length <= 1, "Une seule image principale est autorisée.").optional(),
  documents: z.array(z.object({ name: z.string().trim().min(1).max(250), type: z.enum(["TECHNICAL_SHEET", "INSTALLATION_MANUAL", "DIMENSION_DRAWING", "CERTIFICATE", "COMMERCIAL_DOCUMENT", "OTHER"]), url: publicUrlSchema, isPublic: z.boolean(), sortOrder: z.number().int().min(0).max(10000) }).strict()).max(100).optional(),
  variantPresentation: z.array(z.object({ id: z.string().min(1).max(200), label: z.string().max(500), enabled: z.boolean(), sortOrder: z.number().int().min(0).max(10000) }).strict()).max(500).refine(items=>new Set(items.map(item=>item.id)).size===items.length,"Une variante ne peut apparaître qu’une fois.").optional(),
}).strict();
export type ProductPresentation = z.infer<typeof productPresentationSchema>;
export function applyProductPresentation(product: CatalogueProduct, value: unknown): CatalogueProduct {
  const parsed = productPresentationSchema.safeParse(value);
  if (!parsed.success) return product;
  const { variantPresentation, media, categoryId, ...fields } = parsed.data;
  const variants = applyVariantPresentation(product.variants || [], variantPresentation);
  return { ...product, ...fields, categoryId: categoryId === undefined ? product.categoryId : categoryId || undefined, ...(media ? { media: media.filter(item => item.enabled).sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.sortOrder - b.sortOrder) } : {}), variants, baseVariants: product.variants, variantPresentation,
    variantCount: variants?.length || 1, presentationManagedKeys: Object.keys(parsed.data) };
}

export function applyVariantPresentation(variants:CatalogueVariant[], presentation:ProductPresentation["variantPresentation"]):CatalogueVariant[]{
 if(!presentation)return variants;const byId=new Map(presentation.map(item=>[item.id,item]));return variants.filter(item=>byId.get(item.id)?.enabled!==false).map(item=>({...item,label:byId.get(item.id)?.label || item.label})).sort((a,b)=>(byId.get(a.id)?.sortOrder??10000)-(byId.get(b.id)?.sortOrder??10000));
}

export function resolvePresentedVariants(product:CatalogueProduct,family:CatalogueVariant[]):CatalogueVariant[]{
 const base=product.baseVariants || product.variants || [];
 const single:CatalogueVariant={id:product.id,code:product.code,supplierCode:product.supplierCode,name:product.name,label:product.name,priceHT:product.priceHT,delay:product.delay,stock:product.stock,weightKg:product.weightKg,shippingMode:product.shippingMode,imageRef:product.imageRef,features:product.features,options:{}};
 const source=product.includeSupplierFamilyVariants ? [...(family.length>1?family:[single]),...base] : base.length?base:family.length>1?family:[single];
 return applyVariantPresentation([...new Map(source.map(item=>[item.id,item])).values()],product.variantPresentation);
}
