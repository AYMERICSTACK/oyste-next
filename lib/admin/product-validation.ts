import { z } from "zod";
export const createProductSchema = z.object({
  name: z.string().trim().min(1).max(250),
  code: z.string().trim().min(1).max(100).regex(/^[A-Za-z0-9_-]+$/),
  slug: z.string().min(1).max(200).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  priceHt: z.number().finite().nonnegative().max(9999999999.99),
  categoryId: z.string().min(1).max(200).nullable(),
}).strict();
export const manualProductSchema = z.object({
  name: z.string().trim().min(1).max(250),
  description: z.string().max(20000), detailedDescription: z.string().max(100000),
  priceHt: z.number().finite().nonnegative().max(9999999999.99), stock: z.number().int().nonnegative().max(2147483647),
  seoTitle: z.string().max(250), seoDescription: z.string().max(10000),
}).strict();
export function isAdminCreated(source: unknown): boolean {
  return !!source && typeof source === "object" && !Array.isArray(source) && (source as Record<string, unknown>).adminCreated === true;
}
