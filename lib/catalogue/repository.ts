import productsData from "@/data/catalogue/products.json";
import categoriesData from "@/data/catalogue/categories.json";
import statsData from "@/data/catalogue/stats.json";
import { getImportedProductDocumentsExact, getImportedProductImagesExact } from "@/lib/catalogue/media";

export type CatalogueFeature = {
  label: string;
  value: string;
};

export type CatalogueVariant = {
  id: string;
  code: string;
  supplierCode: string;
  name: string;
  label: string;
  priceHT: number | null;
  delay: string;
  stock: number | null;
  imageRef: string;
  features: CatalogueFeature[];
  options: Record<string, string>;
};

export type CatalogueOption = {
  label: string;
  values: string[];
};

export type ProductExperienceType = "STANDARD" | "CONFIGURABLE";

export type CatalogueFaqItem = {
  question: string;
  answer: string;
};

export type CatalogueProduct = {
  id: string;
  code: string;
  supplierCode: string;
  parentCode: string;
  slug: string;
  name: string;
  shortName: string;
  manufacturer: string;
  categorySlug: string;
  categoryPath: string;
  categories: string[];
  description: string;
  detailedDescription: string;
  priceHT: number | null;
  minPriceHT?: number | null;
  maxPriceHT?: number | null;
  delay: string;
  stock: number | null;
  imageRef: string;
  features: CatalogueFeature[];
  variantCount?: number;
  optionSchema?: CatalogueOption[];
  variants?: CatalogueVariant[];
  href: string;
  experienceType?: ProductExperienceType;
  configuratorFamily?: string | null;
  marketingBadges?: string[];
  faq?: CatalogueFaqItem[];
  videoUrls?: string[];
  relatedProductCodes?: string[];
  accessoryProductCodes?: string[];
};

export type CatalogueCategory = {
  slug: string;
  title: string;
  description: string;
  count: number;
};

export type CatalogueSubFamily = {
  title: string;
  href: string;
  mode?: "catalogue" | "configurator";
};

const rawProducts = productsData as CatalogueProduct[];
const rawCategories = categoriesData as CatalogueCategory[];

const virtualPotenceProducts: CatalogueProduct[] = [
  {
    id: "virtual-potence-sur-fut",
    code: "POTENCE-SUR-FUT",
    supplierCode: "OYSTE",
    parentCode: "PFI",
    slug: "potence-sur-fut",
    name: "Potence sur fût",
    shortName: "Potence sur fût",
    manufacturer: "OYSTE",
    categorySlug: "levage",
    categoryPath: "Levage\\Potence sur fût",
    categories: ["Levage", "Potence sur fût"],
    description: "Potence sur fût configurable selon la charge, la portée, la hauteur sous fer, la rotation et les options de levage.",
    detailedDescription: "La potence sur fût OYSTE est une solution de levage sur mesure destinée aux postes de travail industriels. La fiche présente le produit pour le référencement et l'information client, puis le configurateur guide le choix technique.",
    priceHT: null,
    minPriceHT: null,
    maxPriceHT: null,
    delay: "Délai sur étude",
    stock: null,
    imageRef: "PFI5003000",
    features: [
      { label: "Famille", value: "Potence sur fût" },
      { label: "Configuration", value: "Charge, portée, HSF, rotation et options" },
      { label: "Parcours", value: "Configurateur OYSTE" },
    ],
    variantCount: 1,
    optionSchema: [],
    variants: [],
    href: "/catalogue/levage/potence-sur-fut",
    experienceType: "CONFIGURABLE",
    configuratorFamily: "PFI",
    marketingBadges: ["Sur mesure", "Fabrication industrielle"],
  },
  {
    id: "virtual-potence-murale",
    code: "POTENCE-MURALE",
    supplierCode: "OYSTE",
    parentCode: "PMI",
    slug: "potence-murale",
    name: "Potence murale",
    shortName: "Potence murale",
    manufacturer: "OYSTE",
    categorySlug: "levage",
    categoryPath: "Levage\\Potence murale",
    categories: ["Levage", "Potence murale"],
    description: "Potence murale configurable selon la charge, la portée, le support, la hauteur sous fer et les options compatibles.",
    detailedDescription: "La potence murale OYSTE est destinée aux zones où la fixation sur support existant permet de libérer le sol. La fiche reste indexable pour le SEO et renvoie vers le configurateur pour valider le besoin technique.",
    priceHT: null,
    minPriceHT: null,
    maxPriceHT: null,
    delay: "Délai sur étude",
    stock: null,
    imageRef: "PFI5003000",
    features: [
      { label: "Famille", value: "Potence murale" },
      { label: "Configuration", value: "Charge, portée, support, HSF et options" },
      { label: "Parcours", value: "Configurateur OYSTE" },
    ],
    variantCount: 1,
    optionSchema: [],
    variants: [],
    href: "/catalogue/levage/potence-murale",
    experienceType: "CONFIGURABLE",
    configuratorFamily: "PMI",
    marketingBadges: ["Sur mesure", "Gain de place"],
  },
];


export const catalogueSubFamilies: Record<string, CatalogueSubFamily[]> = {
  levage: [
    { title: "Accessoires de levage", href: "/catalogue/levage?famille=accessoires-de-levage" },
    { title: "Charge d'essai", href: "/catalogue/levage?famille=charge-dessai" },
    { title: "Élévateur de charge", href: "/catalogue/levage?famille=elevateur-de-charge" },
    { title: "Palan", href: "/catalogue/levage?famille=palan" },
    { title: "Portique", href: "/catalogue/levage?famille=portique" },
    { title: "Potence murale", href: "/catalogue/levage?famille=potence-murale", mode: "catalogue" },
    { title: "Potence sur fût", href: "/catalogue/levage?famille=potence-sur-fut", mode: "catalogue" },
    { title: "Tripode", href: "/catalogue/levage?famille=tripode" },
  ],
  "manutention-au-sol": [
    { title: "Accessoire de chariot élévateur", href: "/catalogue/manutention-au-sol?famille=accessoire-de-chariot-elevateur" },
    { title: "Chariot et servante", href: "/catalogue/manutention-au-sol?famille=chariot-et-servante" },
    { title: "Coins roulants et patins rouleurs", href: "/catalogue/manutention-au-sol?famille=coins-roulants-et-patins-rouleurs" },
    { title: "Cric et vérin", href: "/catalogue/manutention-au-sol?famille=cric-et-verin" },
    { title: "Diable", href: "/catalogue/manutention-au-sol?famille=diable" },
    { title: "Gerbeur", href: "/catalogue/manutention-au-sol?famille=gerbeur" },
    { title: "Grue d'atelier", href: "/catalogue/manutention-au-sol?famille=grue-datelier" },
    { title: "Table élévatrice", href: "/catalogue/manutention-au-sol?famille=table-elevatrice" },
    { title: "Tireur pousseur", href: "/catalogue/manutention-au-sol?famille=tireur-pousseur" },
    { title: "Transpalette", href: "/catalogue/manutention-au-sol?famille=transpalette" },
  ],
  "motorisation-sew": [
    { title: "Huile", href: "/catalogue/motorisation-sew?famille=huile" },
    { title: "Moteur", href: "/catalogue/motorisation-sew?famille=moteur" },
    { title: "Variateur", href: "/catalogue/motorisation-sew?famille=variateur" },
  ],
  "stockage-emballage": [
    { title: "Dérouleurs", href: "/catalogue/stockage-emballage?famille=derouleurs" },
    { title: "Équipement de quai", href: "/catalogue/stockage-emballage?famille=equipement-de-quai" },
    { title: "Kits de cerclage", href: "/catalogue/stockage-emballage?famille=kits-de-cerclage" },
    { title: "Outils de cerclage", href: "/catalogue/stockage-emballage?famille=outils-de-cerclage" },
  ],
  "acces-hauteur": [
    { title: "Escabeau", href: "/catalogue/acces-hauteur?famille=escabeau" },
    { title: "Marchepied", href: "/catalogue/acces-hauteur?famille=marchepied" },
    { title: "Nacelle", href: "/catalogue/acces-hauteur?famille=nacelle" },
    { title: "Plate-Forme individuelle modulable", href: "/catalogue/acces-hauteur?famille=plate-forme-individuelle-modulable" },
  ],
};

export const catalogueCategoryContent: Record<string, { breadcrumb: string; title: string; description: string }> = {
  levage: {
    breadcrumb: "Catalogue manutention OYSTE > Levage",
    title: "Levage",
    description:
      "OYSTE regroupe ici les équipements de levage standards : accessoires de levage, charges d'essai, élévateurs de charge, palans, portiques et tripodes. Les potences disposent de fiches catalogue dédiées pour présenter les modèles, puis orientent vers le configurateur afin de garantir une solution adaptée.",
  },
  "manutention-au-sol": {
    breadcrumb: "Catalogue manutention OYSTE > Manutention au sol",
    title: "Manutention au sol",
    description:
      "OYSTE met à votre disposition une large gamme d'équipement de manutention au sol. Vous trouverez entre autre une sélection de chariots, diables, gerbeurs, grues d'ateliers, table élévatrices ou bien encore les différents types de transpalettes.",
  },
  "motorisation-sew": {
    breadcrumb: "Catalogue manutention OYSTE > Motorisation SEW",
    title: "Motorisation SEW",
    description: "Moteurs, variateurs et huiles SEW pour vos besoins de motorisation industrielle.",
  },
  "stockage-emballage": {
    breadcrumb: "Catalogue manutention OYSTE > Stockage et emballage",
    title: "Stockage et emballage",
    description: "Dérouleurs, équipements de quai, kits de cerclage et outils de cerclage pour organiser et sécuriser les flux d'atelier.",
  },
  "acces-hauteur": {
    breadcrumb: "Catalogue manutention OYSTE > Accès en hauteur",
    title: "Accès en hauteur",
    description:
      "Besoin d'une échelle, d'un échafaudage ou bien encore d'une plate-forme de travail. Oyste met à disposition ces équipements afin de vous garantir une sécurité optimale.",
  },
};

function getMainCategoryFromPath(categoryPath: string | undefined) {
  return (categoryPath || "").split(/\\|>/g)[0]?.trim().toLowerCase() || "";
}

export function getNormalizedCategorySlug(product: CatalogueProduct) {
  const mainCategory = getMainCategoryFromPath(product.categoryPath);

  if (mainCategory === "levage") return "levage";
  if (mainCategory === "manutention au sol") return "manutention-au-sol";
  if (mainCategory === "motorisation sew") return "motorisation-sew";
  if (mainCategory === "stockage et emballage") return "stockage-emballage";
  if (mainCategory === "accès en hauteur" || mainCategory === "acces en hauteur") return "acces-hauteur";

  return product.categorySlug;
}

export function isPotenceProduct(product: Pick<CatalogueProduct, "categoryPath" | "name" | "code" | "parentCode">) {
  const value = `${product.categoryPath} ${product.name} ${product.code} ${product.parentCode}`.toLowerCase();
  return value.includes("potence") || /^(pfi|pft|pmi|pmt|pma|pmam)/i.test(product.parentCode || product.code || "");
}

function normalizeProduct(product: CatalogueProduct): CatalogueProduct {
  const categorySlug = getNormalizedCategorySlug(product);
  const href = `/catalogue/${categorySlug}/${product.slug}`;

  return { ...product, categorySlug, href };
}

export const catalogProducts = [...rawProducts.map(normalizeProduct), ...virtualPotenceProducts];

function getCategoryCount(slug: string) {
  return catalogProducts.filter((product) => product.categorySlug === slug).length;
}

const baseCategories: CatalogueCategory[] = [
  {
    slug: "levage",
    title: "Levage",
    description: catalogueCategoryContent.levage.description,
    count: getCategoryCount("levage"),
  },
  {
    slug: "manutention-au-sol",
    title: "Manutention au sol",
    description: catalogueCategoryContent["manutention-au-sol"].description,
    count: getCategoryCount("manutention-au-sol"),
  },
  {
    slug: "motorisation-sew",
    title: "Motorisation SEW",
    description: catalogueCategoryContent["motorisation-sew"].description,
    count: getCategoryCount("motorisation-sew"),
  },
  {
    slug: "stockage-emballage",
    title: "Stockage et emballage",
    description: catalogueCategoryContent["stockage-emballage"].description,
    count: getCategoryCount("stockage-emballage"),
  },
  {
    slug: "acces-hauteur",
    title: "Accès en hauteur",
    description: catalogueCategoryContent["acces-hauteur"].description,
    count: getCategoryCount("acces-hauteur"),
  },
];

export const catalogCategories = baseCategories.length ? baseCategories : rawCategories;
export const catalogStats = statsData as {
  source: string;
  allowedManufacturers: string[];
  importedAt: string;
  importedProducts: number;
  importedParentProducts?: number;
  importedVariants?: number;
  ignoredRows: number;
  groupedProducts?: number;
  byManufacturer: Record<string, number>;
  byCategory: Record<string, number>;
};

const SUPPLIER_PLACEHOLDER_RE = /^Produit\s+[A-Z0-9&_. -]+\s+r[ée]f[ée]renc[ée]\s+au catalogue OYSTE\.?$/i;


export const CONFIGURATOR_FAMILIES = ["PFI", "PFT", "PMI", "PMT", "PMA", "PMAM", "PORT"] as const;

export function getProductExperienceType(product: CatalogueProduct): ProductExperienceType {
  if (product.experienceType) return product.experienceType;
  return isPotenceProduct(product) ? "CONFIGURABLE" : "STANDARD";
}

export function getProductConfiguratorFamily(product: CatalogueProduct) {
  if (product.configuratorFamily) return product.configuratorFamily.toUpperCase();
  const candidates = [product.parentCode, product.code]
    .filter(Boolean)
    .map((value) => String(value).toUpperCase());
  return CONFIGURATOR_FAMILIES.find((family) =>
    candidates.some((value) => value === family || value.startsWith(family)),
  ) || null;
}

export function getProductConfiguratorHref(product: CatalogueProduct) {
  const family = getProductConfiguratorFamily(product);
  const params = new URLSearchParams({ produit: product.slug });
  if (family) {
    params.set("famille", family);
    params.set("type", family);
  }
  return `/configurateur?${params.toString()}`;
}

export function getProductMarketingBadges(product: CatalogueProduct) {
  const configured = product.marketingBadges?.filter(Boolean) || [];
  if (configured.length) return configured.slice(0, 4);
  if (getProductExperienceType(product) === "CONFIGURABLE") {
    return ["Produit sur mesure", "Configuration guidée", "Étude technique"];
  }
  return ["Achat en ligne", "Usage professionnel", "Sélection OYSTE"];
}

export function getProductFaq(product: CatalogueProduct): CatalogueFaqItem[] {
  if (product.faq?.length) return product.faq;
  if (getProductExperienceType(product) === "CONFIGURABLE") {
    const family = getProductConfiguratorFamily(product);
    return [
      { question: "Pourquoi ce produit doit-il être configuré ?", answer: "La capacité, la portée, la rotation et les options influencent directement la référence finale. Le configurateur sécurise ce choix avant l'ajout au panier." },
      { question: "Puis-je obtenir un accompagnement technique ?", answer: "Oui. L'équipe OYSTE peut vérifier votre besoin et vous accompagner avant la validation définitive de la configuration." },
      { question: "La configuration sera-t-elle ajoutée au panier ?", answer: `Oui. Une fois la configuration ${family ? family + " " : ""}terminée, la solution revient dans le parcours e-commerce comme un produit classique.` },
    ];
  }
  return [
    { question: "Comment choisir la bonne référence ?", answer: "Utilisez les variantes, les caractéristiques techniques et les documents de la fiche. En cas de doute, l'équipe OYSTE peut confirmer la compatibilité." },
    { question: "Le prix affiché est-il hors taxes ?", answer: "Oui. Les tarifs du catalogue professionnel OYSTE sont affichés hors taxes sauf mention contraire." },
    { question: "Puis-je commander directement en ligne ?", answer: "Oui, lorsque le produit est disponible à la vente, sélectionnez la variante souhaitée puis ajoutez-la au panier." },
  ];
}

export function isSupplierPlaceholder(value: string | null | undefined) {
  return !!value && SUPPLIER_PLACEHOLDER_RE.test(value.trim());
}

export function getCustomerProductDescription(product: CatalogueProduct) {
  if (product.description && !isSupplierPlaceholder(product.description)) {
    return product.description;
  }

  const variants = product.variantCount || product.variants?.length || 1;
  const usage = getProductUsageLabel(product);

  if (variants > 1) {
    return `${usage}. Plusieurs configurations sont disponibles afin d’adapter la solution à votre besoin.`;
  }

  return `${usage}. Produit disponible à l’achat via le catalogue OYSTE.`;
}

export function formatPriceHT(price: number | null | undefined) {
  if (!price) return "Prix sur demande";
  return `${price.toLocaleString("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })} € HT`;
}

export function formatPriceRange(product: CatalogueProduct) {
  const min = product.minPriceHT ?? product.priceHT;
  const max = product.maxPriceHT ?? product.priceHT;

  if (!min) return "Prix sur demande";
  if (!max || min === max) return formatPriceHT(min);
  return `À partir de ${formatPriceHT(min)}`;
}

export function normalizeCategoryQuery(slug: string) {
  if (["portiques", "palans-palonniers", "accessoires-pieces"].includes(slug)) return "levage";
  return slug;
}

export function getCatalogCategory(slug: string) {
  const normalizedSlug = normalizeCategoryQuery(slug);
  return catalogCategories.find((category) => category.slug === normalizedSlug);
}

export function getProductsByCategory(slug: string) {
  const normalizedSlug = normalizeCategoryQuery(slug);
  return catalogProducts.filter((product) => product.categorySlug === normalizedSlug);
}

export function getProductBySlug(categorySlug: string, productSlug: string) {
  const normalizedSlug = normalizeCategoryQuery(categorySlug);
  return catalogProducts.find(
    (product) => product.categorySlug === normalizedSlug && product.slug === productSlug,
  );
}

export function getFeaturedCatalogProducts(limit = 6) {
  const priority = [
    "levage",
    "manutention-au-sol",
    "motorisation-sew",
    "stockage-emballage",
    "acces-hauteur",
  ];

  return priority
    .flatMap((slug) => getProductsByCategory(slug).slice(0, 2))
    .slice(0, limit);
}

export function formatCategoryLabel(categoryPath: string | undefined) {
  if (!categoryPath) return "Produit catalogue";

  const parts = categoryPath
    .split(/\\|>|\//g)
    .map((part) => part.trim())
    .filter(Boolean);

  return parts.at(-1) || "Produit catalogue";
}

export function getProductUsageLabel(product: CatalogueProduct) {
  const category = product.categorySlug;

  if (category === "levage") return "Levage, suspension et manipulation de charges";
  if (category === "motorisation-sew") return "Motorisation industrielle et transmission";
  if (category === "manutention-au-sol") return "Déplacement et manutention au sol";
  if (category === "acces-hauteur") return "Accès en hauteur et sécurité d’intervention";
  if (category === "stockage-emballage") return "Stockage, rangement et organisation d’atelier";

  return "Équipement industriel sélectionné par OYSTE";
}

export function getProductHighlights(product: CatalogueProduct) {
  const variants = product.variantCount || product.variants?.length || 1;
  const firstOptions = product.optionSchema?.map((option) => option.label).filter(Boolean) || [];

  return [
    { label: "Type de produit", value: formatCategoryLabel(product.categoryPath) },
    { label: "Utilisation", value: getProductUsageLabel(product) },
    variants > 1
      ? { label: "Configuration", value: `${variants} variantes disponibles${firstOptions.length ? ` : ${firstOptions.join(", ")}` : ""}` }
      : { label: "Configuration", value: "Produit disponible à l’achat" },
    { label: "Prix", value: formatPriceRange(product) },
  ];
}

export function slugifyCatalogueLabel(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " et ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getCategoryTrail(product: Pick<CatalogueProduct, "categoryPath" | "name" | "code" | "parentCode">) {
  return `${product.categoryPath || ""} ${product.name || ""} ${product.code || ""} ${product.parentCode || ""}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function productMatchesFamily(product: CatalogueProduct, familySlug: string) {
  const value = getCategoryTrail(product);

  if (familySlug === "accessoires-de-levage") {
    return /(accessoire|elingue|pince|griffe|crochet|embase|palonnier|leve palette|peson|porteur magnetique|manipulateur)/.test(value);
  }
  if (familySlug === "charge-dessai") return value.includes("charge d'essai") || value.includes("charge dessai");
  if (familySlug === "elevateur-de-charge") return value.includes("elevateur de charge") || value.includes("leve palette");
  if (familySlug === "palan") return /(palan|chariot porte palan|treuil)/.test(value);
  if (familySlug === "portique") return value.includes("portique");
  if (familySlug === "potence-murale") return isPotenceProduct(product) && /(murale|mural|pmi|pmt|pma|pmam)/.test(value);
  if (familySlug === "potence-sur-fut") return isPotenceProduct(product) && /(sur fut|sur fût|fut|fût|pfi|pft)/.test(value);
  if (familySlug === "tripode") return value.includes("tripode");

  if (familySlug === "accessoire-de-chariot-elevateur") return value.includes("accessoire de chariot elevateur");
  if (familySlug === "chariot-et-servante") return /(chariot|servante|plateau roulant|armoire|treteau)/.test(value) && !value.includes("chariot elevateur");
  if (familySlug === "coins-roulants-et-patins-rouleurs") return /(coins roulants|patins rouleurs)/.test(value);
  if (familySlug === "cric-et-verin") return /(cric|verin|chandelle)/.test(value);
  if (familySlug === "diable") return value.includes("diable");
  if (familySlug === "gerbeur") return value.includes("gerbeur");
  if (familySlug === "grue-datelier") return value.includes("grue d'atelier") || value.includes("grue datelier");
  if (familySlug === "table-elevatrice") return value.includes("table elevatrice");
  if (familySlug === "tireur-pousseur") return value.includes("tireur pousseur");
  if (familySlug === "transpalette") return value.includes("transpalette") || value.includes("tanspalette");

  return value.includes(familySlug.replace(/-/g, " ")) || slugifyCatalogueLabel(value).includes(familySlug);
}

export function getSubFamilyBySlug(categorySlug: string, familySlug: string) {
  return (catalogueSubFamilies[categorySlug] || []).find(
    (family) => slugifyCatalogueLabel(family.title) === familySlug || family.href.includes(`famille=${familySlug}`),
  );
}

export function filterProductsByFamily(products: CatalogueProduct[], familySlug?: string) {
  if (!familySlug) return products;
  return products.filter((product) => productMatchesFamily(product, familySlug));
}

export function getProductsByCategoryAndFamily(categorySlug: string, familySlug?: string) {
  return filterProductsByFamily(getProductsByCategory(categorySlug), familySlug);
}

export function getSubFamilyProductCount(categorySlug: string, familySlug: string) {
  return getProductsByCategoryAndFamily(categorySlug, familySlug).length;
}

export function getRelatedProductsFrom(
  products: CatalogueProduct[],
  product: CatalogueProduct,
  limit = 3,
) {
  const familyLabel = formatCategoryLabel(product.categoryPath);
  const familySlug = slugifyCatalogueLabel(familyLabel);

  return products
    .filter((candidate) => candidate.id !== product.id && candidate.categorySlug === product.categorySlug)
    .filter((candidate) => {
      const candidateFamily = slugifyCatalogueLabel(formatCategoryLabel(candidate.categoryPath));
      return candidateFamily === familySlug || candidate.categoryPath?.includes(familyLabel);
    })
    .slice(0, limit);
}

export function getRelatedProducts(product: CatalogueProduct, limit = 3) {
  return getRelatedProductsFrom(catalogProducts, product, limit);
}


export type ProductDocumentKind = "technical-sheet" | "manual" | "dimensional-drawing" | "declaration" | "exploded-view";

export type ProductDocument = {
  kind: ProductDocumentKind;
  title: string;
  description: string;
  status: "available" | "on-request" | "configured" | "disabled";
  href: string;
  filename?: string;
  filetype?: string;
  reference?: string;
  displayName?: string;
  source?: "media-manifest" | "generated" | "request" | "future";
  isVisible: boolean;
};

export type ProductTechnicalRow = {
  label: string;
  value: string;
};

export type ProductConfigurationRow = {
  id: string;
  reference: string;
  label: string;
  price: string;
  options: Record<string, string>;
};


const DANGLING_TECHNICAL_WORDS = new Set([
  "de",
  "du",
  "des",
  "le",
  "la",
  "les",
  "un",
  "une",
  "pour",
  "par",
  "avec",
  "sans",
  "sur",
  "sous",
  "dans",
  "dont",
  "et",
  "ou",
  "à",
  "au",
  "aux",
  "en",
  "que",
  "qui",
  "son",
  "sa",
  "ses",
  "leur",
  "leurs",
]);

const WEAK_TECHNICAL_TRAILING_WORDS = new Set([
  "faible",
  "faibles",
  "grand",
  "grande",
  "grandes",
  "petit",
  "petite",
  "petites",
  "maximum",
  "minimum",
  "maxi",
  "mini",
  "min",
  "max",
]);

const INCOMPLETE_TECHNICAL_PATTERNS = [
  /\bd[uû]e?\s+[aà]\s+son\s+faible$/i,
  /\bgrande?\s+souplesse\s+de$/i,
  /\bpour\s+le$/i,
  /\bpour\s+la$/i,
  /\bpour\s+les$/i,
  /\blivr[ée]\s+avec$/i,
  /\bmaximum\s*:?\s*[^a-z0-9]*min$/i,
];

function cleanCatalogueText(value: string | null | undefined) {
  return (value || "")
    .replace(/\s+/g, " ")
    .replace(/\s+([:;,.])/g, "$1")
    .split(/\b(?:pensez à|attention|veuillez|consultez|voir le détail|fiche technique|documentation)\b/i)[0]
    .replace(/[;,:-]+$/g, "")
    .trim();
}

function normalizeCatalogueQualityText(value: string) {
  return cleanCatalogueText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[.,;:!?]+$/g, "")
    .trim();
}

function isIncompleteCatalogueFragment(value: string) {
  const normalized = normalizeCatalogueQualityText(value);
  if (!normalized) return true;
  if (INCOMPLETE_TECHNICAL_PATTERNS.some((pattern) => pattern.test(normalized))) return true;

  const words = normalized.split(" ").filter(Boolean);
  const lastWord = words.at(-1);
  if (lastWord && WEAK_TECHNICAL_TRAILING_WORDS.has(lastWord)) return true;

  const lastTwo = words.slice(-2).join(" ");
  const lastThree = words.slice(-3).join(" ");

  return ["son faible", "sa faible", "leur faible", "leurs faibles", "a son", "à son"].includes(lastTwo) ||
    ["du a son", "due a son", "dû a son", "grande souplesse de"].includes(lastThree);
}

function isCompleteCatalogueValue(value: string, minLength = 2) {
  const clean = cleanCatalogueText(value);
  if (!clean) return false;
  if (clean.length < minLength && !/\d/.test(clean)) return false;

  const lastWord = normalizeCatalogueQualityText(clean)
    .split(" ")
    .filter(Boolean)
    .at(-1);

  if (lastWord && DANGLING_TECHNICAL_WORDS.has(lastWord)) return false;
  if (isIncompleteCatalogueFragment(clean)) return false;

  return true;
}

function cleanTechnicalRow(row: ProductTechnicalRow): ProductTechnicalRow | null {
  const label = cleanCatalogueText(row.label);
  const value = cleanCatalogueText(row.value);

  if (!label || !isCompleteCatalogueValue(value)) return null;

  return { label, value };
}

function uniqTechnicalRows(rows: ProductTechnicalRow[]) {
  const seen = new Set<string>();

  return rows
    .map(cleanTechnicalRow)
    .filter((row): row is ProductTechnicalRow => Boolean(row))
    .filter((row) => {
      const key = `${row.label}:${row.value}`.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function formatCompactValues(values: string[], limit = 8) {
  const cleaned = Array.from(
    new Set(
      values
        .map((value) => cleanCatalogueText(value))
        .filter((value) => isCompleteCatalogueValue(value)),
    ),
  );
  if (!cleaned.length) return "";

  const visible = cleaned.slice(0, limit).join(" / ");
  const remaining = cleaned.length - limit;

  return remaining > 0 ? `${visible} / +${remaining}` : visible;
}

function isVariantCombinationFeature(feature: CatalogueFeature, optionLabels: string[]) {
  const label = feature.label.toLowerCase();
  const normalizedOptionLabels = optionLabels.map((option) => option.toLowerCase());

  if (label.includes(" / ")) return true;
  if (normalizedOptionLabels.length > 1 && normalizedOptionLabels.every((option) => label.includes(option))) return true;

  return false;
}

export function getProductTechnicalRows(product: CatalogueProduct, limit = 12): ProductTechnicalRow[] {
  const rows: ProductTechnicalRow[] = [
    { label: "Référence", value: product.parentCode || product.code },
    { label: "Famille", value: formatCategoryLabel(product.categoryPath) },
    { label: "Marque / fabricant", value: product.manufacturer || "OYSTE" },
  ];

  const variantCount = product.variantCount || product.variants?.length || 1;
  if (variantCount > 1) rows.push({ label: "Variantes catalogue", value: `${variantCount} configurations` });

  const optionLabels = product.optionSchema?.map((option) => option.label).filter(Boolean) || [];

  product.optionSchema?.slice(0, 8).forEach((option) => {
    const value = formatCompactValues(option.values, 10);
    if (value) rows.push({ label: option.label, value });
  });

  const productFeatureRows = uniqTechnicalRows(product.features || [])
    .filter((feature) => !rows.some((row) => row.label.toLowerCase() === feature.label.toLowerCase()));

  productFeatureRows.slice(0, 8).forEach((feature) => rows.push(feature));

  const variantFeatureGroups = new Map<string, string[]>();
  (product.variants || []).forEach((variant) => {
    (variant.features || []).forEach((feature) => {
      if (isVariantCombinationFeature(feature, optionLabels)) return;
      if (rows.some((row) => row.label.toLowerCase() === feature.label.toLowerCase())) return;

      const values = variantFeatureGroups.get(feature.label) || [];
      values.push(feature.value);
      variantFeatureGroups.set(feature.label, values);
    });
  });

  Array.from(variantFeatureGroups.entries())
    .slice(0, 4)
    .forEach(([label, values]) => {
      const value = formatCompactValues(values, 8);
      if (value) rows.push({ label, value });
    });

  if (product.delay) rows.push({ label: "Délai", value: product.delay });
  if (product.stock !== null && product.stock !== undefined) rows.push({ label: "Stock indicatif", value: String(product.stock) });

  return uniqTechnicalRows(rows).slice(0, limit);
}

export function getProductConfigurationColumns(product: CatalogueProduct) {
  const schemaLabels = product.optionSchema?.map((option) => option.label).filter(Boolean) || [];
  if (schemaLabels.length) return schemaLabels.slice(0, 5);

  const discovered = new Set<string>();
  (product.variants || []).forEach((variant) => {
    Object.keys(variant.options || {}).forEach((key) => discovered.add(key));
  });

  return Array.from(discovered).slice(0, 5);
}

export function getProductConfigurationRows(product: CatalogueProduct, limit = 12): ProductConfigurationRow[] {
  const variants = product.variants || [];
  const columns = getProductConfigurationColumns(product);

  return variants.slice(0, limit).map((variant) => ({
    id: variant.id,
    reference: variant.code || variant.supplierCode || product.code,
    label: variant.label || variant.name,
    price: formatPriceHT(variant.priceHT),
    options: columns.reduce<Record<string, string>>((acc, column) => {
      acc[column] = variant.options?.[column] || "—";
      return acc;
    }, {}),
  }));
}


function getProductMediaReferences(product: CatalogueProduct, variantLimit = 24) {
  // Keep only references explicitly attached to the product or one of its
  // variants. Parent/family codes and supplier aliases are intentionally
  // excluded: they are too broad for a public product gallery.
  return [
    product.imageRef,
    product.code,
    ...(product.variants || [])
      .slice(0, variantLimit)
      .flatMap((variant) => [variant.imageRef, variant.code]),
  ];
}

export function getProductMediaImages(product: CatalogueProduct) {
  return getImportedProductImagesExact(...getProductMediaReferences(product));
}


export function getProductAvailableDocumentCount(product: CatalogueProduct) {
  return getImportedProductDocumentsExact(...getProductMediaReferences(product)).length;
}


function getDocumentReference(filename?: string) {
  if (!filename) return undefined;

  const baseName = filename.split(/[\\/]/).pop() || filename;
  const withoutExtension = baseName.replace(/\.[a-z0-9]+$/i, "");
  const clean = withoutExtension.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();

  return clean || undefined;
}

export function getProductDocuments(product: CatalogueProduct): ProductDocument[] {
  const importedDocuments = getImportedProductDocumentsExact(...getProductMediaReferences(product));

  const technicalSheets: ProductDocument[] = importedDocuments.map((document) => {
    const extension = document.filename?.split(".").pop()?.toLowerCase() || "pdf";
    const reference = getDocumentReference(document.filename);

    return {
      kind: "technical-sheet",
      title: "Fiche technique",
      description: reference ? `Réf. : ${reference}` : "Document PDF",
      status: "available",
      href: document.href,
      filename: document.filename,
      filetype: extension,
      reference,
      source: "media-manifest",
      isVisible: true,
    };
  });

  const futureDocumentTypes: ProductDocument[] = [
    {
      kind: "manual",
      title: "Notice d'utilisation",
      description: "Notice d'installation, d'utilisation ou de maintenance.",
      status: "disabled",
      href: "#",
      source: "future",
      isVisible: false,
    },
    {
      kind: "dimensional-drawing",
      title: "Plan d'encombrement",
      description: "Plan coté, schéma d'encombrement ou plan de principe.",
      status: "disabled",
      href: "#",
      source: "future",
      isVisible: false,
    },
    {
      kind: "declaration",
      title: "Déclaration de conformité",
      description: "Déclaration CE, certificat ou document de conformité fournisseur.",
      status: "disabled",
      href: "#",
      source: "future",
      isVisible: false,
    },
    {
      kind: "exploded-view",
      title: "Vue éclatée",
      description: "Vue pièces, nomenclature ou document de maintenance détaillé.",
      status: "disabled",
      href: "#",
      source: "future",
      isVisible: false,
    },
  ];

  if (technicalSheets.length > 0) return [...technicalSheets, ...futureDocumentTypes];

  return [
    {
      kind: "technical-sheet",
      title: "Fiche technique",
      description: "Documentation disponible sur demande.",
      status: "on-request",
      href: "#demande-devis",
      source: "request",
      isVisible: true,
    },
    ...futureDocumentTypes,
  ];
}

export function getProductTrustBadges(product: CatalogueProduct) {
  const badges = ["Usage professionnel", "Conseil technique OYSTE", "Achat en ligne"];

  if (isPotenceProduct(product)) return ["Produit configurable", "Dimensionnement guidé", ...badges.slice(0, 2)];
  if ((product.variantCount || product.variants?.length || 1) > 1) return ["Variantes disponibles", "Données techniques", ...badges];
  return ["Référence catalogue", ...badges];
}

function scoreCrossSellCandidate(source: CatalogueProduct, candidate: CatalogueProduct) {
  if (candidate.id === source.id) return -100;

  const sourceTrail = getCategoryTrail(source);
  const candidateTrail = getCategoryTrail(candidate);
  let score = 0;

  if (candidate.categorySlug === source.categorySlug) score += 2;
  if (candidate.minPriceHT != null || candidate.priceHT != null || candidate.variants?.some((variant) => variant.priceHT != null)) score += 1;

  const sourceIsPotence = isPotenceProduct(source);
  const candidateIsPotence = isPotenceProduct(candidate);

  if (sourceIsPotence) {
    if (/(palan|chariot porte palan)/.test(candidateTrail)) score += 9;
    if (/(telecommande|radiocommande|limiteur|crochet|elingue|accessoire)/.test(candidateTrail)) score += 6;
    if (/portique|tripode/.test(candidateTrail)) score -= 2;
  }

  if (/(palan|treuil)/.test(sourceTrail)) {
    if (/(chariot porte palan|chariot manuel|chariot motorise)/.test(candidateTrail)) score += 9;
    if (candidateIsPotence || /portique|tripode/.test(candidateTrail)) score += 6;
    if (/(crochet|elingue|pince|accessoire)/.test(candidateTrail)) score += 5;
  }

  if (/portique/.test(sourceTrail)) {
    if (/(palan|chariot porte palan|treuil)/.test(candidateTrail)) score += 9;
    if (/(elingue|crochet|accessoire)/.test(candidateTrail)) score += 5;
  }

  if (/(elingue|crochet|pince|palonnier|accessoire)/.test(sourceTrail)) {
    if (/(palan|portique|potence|tripode)/.test(candidateTrail)) score += 7;
  }

  if (/(transpalette|gerbeur|diable|table elevatrice|grue d'atelier|grue datelier)/.test(sourceTrail)) {
    if (/(accessoire de chariot|chariot|servante|cric|verin)/.test(candidateTrail)) score += 7;
  }

  if (/(moteur|variateur|sew)/.test(sourceTrail)) {
    if (/(huile|moteur|variateur|sew)/.test(candidateTrail)) score += 8;
  }

  if (/(cerclage|derouleur|quai)/.test(sourceTrail)) {
    if (/(cerclage|derouleur|quai|emballage)/.test(candidateTrail)) score += 8;
  }

  if (/(escabeau|marchepied|nacelle|plate-forme|plateforme)/.test(sourceTrail)) {
    if (/(escabeau|marchepied|nacelle|plate-forme|plateforme)/.test(candidateTrail)) score += 8;
  }

  return score;
}

export function getCrossSellProductsFrom(
  products: CatalogueProduct[],
  product: CatalogueProduct,
  limit = 4,
) {
  return products
    .map((candidate) => ({ candidate, score: scoreCrossSellCandidate(product, candidate) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const aVariants = a.candidate.variantCount || a.candidate.variants?.length || 1;
      const bVariants = b.candidate.variantCount || b.candidate.variants?.length || 1;
      return bVariants - aVariants;
    })
    .map(({ candidate }) => candidate)
    .slice(0, limit);
}

export function getCrossSellProducts(product: CatalogueProduct, limit = 4) {
  return getCrossSellProductsFrom(catalogProducts, product, limit);
}

export function getCategoryFacets(products: CatalogueProduct[]) {
  const configurableProducts = products.filter((product) => (product.variantCount || product.variants?.length || 1) > 1);
  const totalVariants = products.reduce(
    (sum, product) => sum + (product.variantCount || product.variants?.length || 1),
    0,
  );

  return { configurableProducts, totalVariants };
}
