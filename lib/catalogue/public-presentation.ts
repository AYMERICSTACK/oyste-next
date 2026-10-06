import { productPresentationSchema } from "./product-presentation";
import { prisma } from "@/lib/db/prisma";
import { getProductCardImages, type CatalogueProduct } from "./repository";
import { getDatabaseProductsByCategory } from "./database-repository";
import { legacyCategories, legacySuppliers, type PublicCategory } from "./presentation-defaults";
import type { Category, Supplier } from "@/generated/prisma/client";
export const visibleHome = <T extends { isActive: boolean; homeVisible: boolean; homeOrder: number }>(items: T[]) => items.filter(item => item.isActive && item.homeVisible).sort((a, b) => a.homeOrder - b.homeOrder);
export function categoryImage(category: Pick<PublicCategory, "homeImageUrl" | "imageUrl">, home: boolean, representativeImages: string[] = [], catalogueImages: string[] = []) {
  return (home ? category.homeImageUrl : category.imageUrl) || category.imageUrl || representativeImages[0] || catalogueImages[0] || undefined;
}
function representativeImages(product: {media:Array<{url:string}>;presentation?:{value:unknown}|null}|null){
 if(!product)return [];const override=productPresentationSchema.safeParse(product.presentation?.value).data;return override?.media ? override.media.filter(item=>item.enabled).sort((a,b)=>Number(b.isPrimary)-Number(a.isPrimary)||a.sortOrder-b.sortOrder).map(item=>item.url) : product.media.map(item=>item.url);
}
export async function getPublicPresentation() {
  let historical: PublicCategory[] | undefined;
  async function fallback() {
    if (!historical) {
      let products: CatalogueProduct[] = [];
      try { products = await getDatabaseProductsByCategory("acces-hauteur"); } catch { /* Static family images remain reliable. */ }
      historical = legacyCategories(products);
    }
    return historical;
  }
  try {
    const [setting, records, suppliers] = await Promise.all([
      prisma.siteSetting.findUnique({ where: { key: "cms.catalogue.ready" } }),
      prisma.category.findMany({ include: { representativeProduct: { include: { presentation:true, media: { where: { type: "IMAGE" }, orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }] } } }, products: { where: { publicationStatus: "PUBLISHED", media: { some: { type: "IMAGE" } } }, select: { media: { where: { type: "IMAGE" }, orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }], take: 1 } }, take: 1 } } }),
      prisma.supplier.findMany({ orderBy: [{ homeOrder: "asc" }, { name: "asc" }] }),
    ]);
    const ready = setting?.value === true;
    const configured = records.filter(item => item.presentationConfigured);
    const categories: PublicCategory[] = configured.map(item => ({ ...item,
      publicTags: Array.isArray(item.publicTags) ? item.publicTags.filter((tag): tag is string => typeof tag === "string") : [],
      imageUrl: (item.representativeProductId ? representativeImages(item.representativeProduct)[0] : undefined) || categoryImage(item as unknown as PublicCategory, false, representativeImages(item.representativeProduct), item.products.flatMap(product => product.media.map(media => media.url))),
      homeImageUrl: (item.representativeProductId ? representativeImages(item.representativeProduct)[0] : undefined) || categoryImage(item as unknown as PublicCategory, true, representativeImages(item.representativeProduct), item.products.flatMap(product => product.media.map(media => media.url))),
    })).map(item => ({ ...item, imageUrl: item.imageUrl || null, homeImageUrl: item.homeImageUrl || null }));
    if (!ready) {
      const old = await fallback();
      const matching = (item: PublicCategory) => configured.find(record => record.slug === item.slug || (record.publicFamilySlug === item.publicFamilySlug && record.publicHref === item.publicHref));
      const idMap = new Map(old.map(item => [item.id, matching(item)?.id ?? item.id]));
      for (const item of old) if (!matching(item)) categories.push({ ...item, parentId: item.parentId ? idMap.get(item.parentId) || item.parentId : null, homeParentId: item.homeParentId ? idMap.get(item.homeParentId) || item.homeParentId : null });
    }
    const homeSuppliers = ready ? suppliers : [
      ...suppliers.filter(item => item.presentationConfigured),
      ...legacySuppliers.filter(old => !suppliers.some(item => item.presentationConfigured && (item.slug === old.slug || item.name.toLowerCase() === old.name.toLowerCase()))),
    ];
    return { categories, suppliers: homeSuppliers, ready };
  } catch {
    return { categories: await fallback(), suppliers: legacySuppliers, ready: false };
  }
}
export async function getPublicCategory(slug: string) {
  const { categories } = await getPublicPresentation();
  return categories.find(item => item.slug === slug && item.isActive && item.catalogueVisible);
}
export function publicFamilies(categories: PublicCategory[], category: PublicCategory) {
  return categories.filter(item => item.homeParentId === category.id && item.isActive && item.catalogueVisible).sort((a, b) => a.sortOrder - b.sortOrder).map(item => ({ ...item, title: item.publicLabel || item.name, href: item.publicHref || `/catalogue/${category.slug}?famille=${item.publicFamilySlug || item.slug}`, mode: item.publicHref?.startsWith("/configurateur") ? "configurator" as const : "catalogue" as const }));
}
export function familyProducts(products: CatalogueProduct[], family: { id: string; publicFamilySlug: string | null }, legacyFilter: (items: CatalogueProduct[], slug?: string) => CatalogueProduct[]) {
  const direct = products.filter(product => product.categoryId === family.id);
  const matched = family.publicFamilySlug ? legacyFilter(products, family.publicFamilySlug) : [];
  return [...new Map([...direct, ...matched].map(product => [product.id, product])).values()];
}
