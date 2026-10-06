// Historical presentation snapshot, used only for initialization and pre-initialization fallback.
import { catalogueUniverses } from "@/data/catalogue";
import { catalogueCategoryContent, catalogueSubFamilies, filterProductsByFamily, getProductsByCategory, getProductsByCategoryAndFamily, getProductCardImages, getProductMediaImages, type CatalogueProduct } from "./repository";
import { getProductImageUrl } from "@/lib/product-images";
export type PublicCategory = {
  id: string; slug: string; name: string; publicLabel: string | null; homeLabel: string | null; description: string | null;
  seoTitle: string | null; seoDescription: string | null; imageUrl: string | null; homeImageUrl: string | null;
  publicSubtitle: string | null; publicTags: string[]; publicHref: string | null; publicFamilySlug: string | null;
  parentId: string | null; homeParentId: string | null; representativeProductId: string | null;
  homeVisible: boolean; catalogueVisible: boolean; isActive: boolean; homeOrder: number; sortOrder: number;
};
const rootImages = ["PFI2502000", "AC251000", "M21487391", "KITTE", "ES2M"];
const rootLabels = ["Levage", "Manutention", "Motorisation SEW", "Stockage", "Accès hauteur"];
const historicalFamilyImages = [
  { root: "levage", family: "palan", home: getProductImageUrl("CB010"), catalogue: getProductImageUrl("CB010") },
  { root: "levage", family: "potence-murale", home: getProductImageUrl("PMI10002000"), catalogue: getProductImageUrl("PMI2502000") },
  { root: "levage", family: "elevateur-de-charge", home: "https://www.stockman.fr/fr/upload/products_data/images/medium/elevateur-leve-charge-manuel-climatiseur-stockman_LP125.jpg", catalogue: getProductImageUrl("LP1") },
  { root: "acces-hauteur", family: "marchepied", home: "https://media.normequip.com/2241006-large_default/marchepieds-en-acier-150-kg.jpg", catalogue: "https://media.normequip.com/2241006-large_default/marchepieds-en-acier-150-kg.jpg" },
  { root: "acces-hauteur", family: "plate-forme-individuelle-modulable", home: "https://www.svelt.ro/_galerie/produse/471/modular-platforma-de-lucru-modulara-20.png", catalogue: "https://www.svelt.ro/_galerie/produse/471/modular-platforma-de-lucru-modulara-20.png" },
];
export function legacyCategories(accessHeightProducts: CatalogueProduct[] = []): PublicCategory[] {
  return catalogueUniverses.flatMap((universe, index) => {
    const representative = getProductsByCategory(universe.slug)[0];
    const root: PublicCategory = {
      id: `legacy:${universe.slug}`, slug: universe.slug, name: universe.title, publicLabel: universe.title, homeLabel: rootLabels[index] || universe.title,
      description: catalogueCategoryContent[universe.slug]?.description || universe.description,
      seoTitle: null, seoDescription: null,
      imageUrl: representative ? getProductMediaImages(representative)[0] || getProductImageUrl(representative.imageRef, representative.code) : null,
      homeImageUrl: getProductImageUrl(rootImages[index] || universe.slug), publicSubtitle: universe.subtitle,
      publicTags: universe.tags, publicHref: universe.href, publicFamilySlug: null, parentId: null, homeParentId: null,
      representativeProductId: null, homeVisible: true, catalogueVisible: true, isActive: true, homeOrder: index, sortOrder: index,
    };
    const children = (catalogueSubFamilies[universe.slug] || []).map((family, order) => {
      const familySlug = family.href.match(/[?&]famille=([^&]+)/)?.[1] || family.title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const historical = historicalFamilyImages.find(item => item.root === universe.slug && item.family === familySlug);
      const staticProduct = getProductsByCategoryAndFamily(universe.slug, familySlug)[0];
      const databaseProduct = universe.slug === "acces-hauteur" ? filterProductsByFamily(accessHeightProducts, familySlug).find(product => getProductCardImages(product).length > 0) : undefined;
      const image = databaseProduct ? getProductCardImages(databaseProduct)[0] : staticProduct ? getProductCardImages(staticProduct)[0] : null;
      return { ...root, id: `legacy:${universe.slug}:${familySlug}`, slug: `${universe.slug}-${familySlug}`, name: family.title, publicLabel: family.title, homeLabel: family.title,
        publicFamilySlug: familySlug, publicHref: family.href, homeParentId: root.id, parentId: root.id,
        imageUrl: historical?.catalogue || image || null, homeImageUrl: historical?.home || image || null,
        description: null, publicSubtitle: null, publicTags: [], homeOrder: order, sortOrder: order };
    });
    return [root, ...children];
  });
}
export const legacySuppliers = [
  { name: "ADEI", slug: "adei", logoUrl: "/brands/adei.png" },
  { name: "KITO", slug: "kito", logoUrl: "/brands/kito.png" },
  { name: "STOCKMAN", slug: "stockman", logoUrl: "/brands/stockman.png" },
  { name: "SEW USOCOME", slug: "sew-usocome", logoUrl: "/brands/sew-usocome.png" },
  { name: "CROMOX", slug: "cromox", logoUrl: "/brands/cromox.jpg" },
  { name: "HYDROBULL", slug: "hydrobull", logoUrl: "/brands/hydrobull.jpg" },
  { name: "COMEPAL", slug: "comepal", logoUrl: "/brands/comepal.png" },
  { name: "GOLIATH", slug: "goliath", logoUrl: "/brands/goliath.png" },
].map((item, homeOrder) => ({ ...item, id: `legacy:${item.slug}`, homeVisible: true, isActive: true, homeOrder, homeHref: null as string | null }));
