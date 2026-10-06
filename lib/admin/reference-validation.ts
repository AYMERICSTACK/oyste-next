import { z } from "zod";
import { publicUrlSchema } from "../cms-validation";
const nullableText = z.string().trim().max(10000).nullable();
const optionalUrl = publicUrlSchema.nullable();
const slug = z.string().min(1).max(200).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Utilisez des lettres minuscules, chiffres et tirets.");
export const supplierInputSchema = z.object({
  name: z.string().trim().min(1).max(200), slug, logoUrl: optionalUrl,
  contactName: nullableText, email: z.email().nullable(), phone: nullableText,
  website: optionalUrl, averageLeadTime: nullableText, internalNotes: nullableText,
  isActive: z.boolean(), homeVisible: z.boolean().optional(), homeOrder: z.number().int().min(0).max(10000).optional(), homeHref: optionalUrl.optional(),
}).strict();
export const categoryInputSchema = z.object({
  name: z.string().trim().min(1).max(200), slug,
  description: nullableText, seoTitle: z.string().max(250).nullable(), seoDescription: nullableText,
  imageUrl: optionalUrl, sortOrder: z.number().int().min(0).max(10000), isActive: z.boolean(),
  parentId: z.string().min(1).max(200).nullable(),
  homeParentId: z.string().min(1).max(200).nullable().optional(),
  representativeProductId: z.string().min(1).max(200).nullable().optional(),
  homeVisible: z.boolean().optional(), catalogueVisible: z.boolean().optional(), homeOrder: z.number().int().min(0).max(10000).optional(),
  homeImageUrl: optionalUrl.optional(), publicLabel: nullableText.optional(), homeLabel: nullableText.optional(), publicSubtitle: nullableText.optional(),
  publicHref: optionalUrl.optional(), publicFamilySlug: slug.nullable().optional(), publicTags: z.array(z.string().trim().min(1).max(100)).max(30).optional(),
}).strict();

export function isIntegrationSupplier(supplier: { code?: unknown; slug?: unknown; name?: unknown }): boolean {
  return !!supplier.code || /stockman|kito|adei|sew|comege|comepal|cromox|hydrobull|goliath/i.test(`${supplier.slug} ${supplier.name}`);
}
