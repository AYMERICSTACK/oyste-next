import { z } from "zod";

const text = z.string().max(10000);
const label = z.string().trim().min(1).max(250);
export const publicUrlSchema = z.string().max(2048).refine(value => {
  if (!value || /[\\\s\u0000-\u001f\u007f]/.test(value)) return false;
  if (value.startsWith("/") && !value.startsWith("//")) return true;
  try { return ["https:", "http:"].includes(new URL(value).protocol); } catch { return false; }
}, "Utilisez un lien interne commençant par / ou une URL http(s).");
const ordered = { enabled: z.boolean(), order: z.number().int().min(0).max(10000) };
export const quickLinksSchema = z.array(z.object({ label, href: publicUrlSchema, ...ordered }).strict()).max(50);
export const slidesSchema = z.array(z.object({ label, title: label, text, href: publicUrlSchema,
  image: publicUrlSchema, ctaLabel: label, ...ordered }).strict()).max(30);
export const cmsContentSchema = z.object({
  version: z.literal(2).optional(),
  home: z.object({
    heroEnabled: z.boolean().optional(), heroEyebrow: text, heroTitle: text, heroAccent: text, heroText: text,
    primaryLabel: text, primaryHref: publicUrlSchema,
    secondaryLabel: text, secondaryHref: publicUrlSchema, heroImage: publicUrlSchema,
    quickLinks: quickLinksSchema.optional(),
    slides: slidesSchema.optional(),
    categoryEyebrow: text.optional(), categoryTitle: text.optional(), catalogueLabel: text.optional(), catalogueHref: publicUrlSchema.optional(),
    supplierEyebrow: text.optional(), supplierTitle: text.optional(),
  }).strict(),
  topbar: z.object({ message: text, email: z.email(), hours: text, enabled: z.boolean() }).strict(),
  navigation: z.array(z.object({ label, href: publicUrlSchema }).strict()).max(50),
  footer: z.object({ description: text, email: z.email(), hours: text, area: text,
    ctaEyebrow: text, ctaTitle: text, ctaText: text, ctaLabel: text, ctaHref: publicUrlSchema }).strict(),
  editorial: z.object({ deliveryTitle: text, deliveryIntro: text, contactTitle: text, contactIntro: text }).strict(),
}).strict();
