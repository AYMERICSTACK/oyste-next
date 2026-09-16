import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import {
  filterProductsByFamily,
  getNormalizedCategorySlug,
  getProductBySlug,
  getProductsByCategory,
  normalizeCategoryQuery,
  type CatalogueFeature,
  type CatalogueOption,
  type CatalogueProduct,
  type CatalogueVariant,
} from "@/lib/catalogue/repository";

const catalogueProductInclude = {
  supplier: true,
  category: true,
  features: { orderBy: { sortOrder: "asc" as const } },
  media: { orderBy: [{ isPrimary: "desc" as const }, { sortOrder: "asc" as const }] },
  documents: { orderBy: { sortOrder: "asc" as const } },
  variants: {
    orderBy: { code: "asc" as const },
    include: {
      features: { orderBy: { sortOrder: "asc" as const } },
    },
  },
} satisfies Prisma.ProductInclude;

type DatabaseProduct = Prisma.ProductGetPayload<{
  include: typeof catalogueProductInclude;
}>;

type SourceProductData = Partial<{
  categoryPath: string;
  categories: string[];
  manufacturer: string;
  href: string;
}>;

function asRecord(value: Prisma.JsonValue | null): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asStringRecord(
  value: Prisma.JsonValue | null,
): Record<string, string> {
  const source = asRecord(value);

  return Object.fromEntries(
    Object.entries(source).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
}

function asOptionSchema(value: Prisma.JsonValue | null): CatalogueOption[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];

    const option = item as Record<string, unknown>;

    if (typeof option.label !== "string" || !Array.isArray(option.values)) {
      return [];
    }

    return [
      {
        label: option.label,
        values: option.values.filter(
          (entry): entry is string => typeof entry === "string",
        ),
      },
    ];
  });
}

function mapFeature(feature: {
  label: string;
  value: string;
}): CatalogueFeature {
  return {
    label: feature.label,
    value: feature.value,
  };
}

function mapVariant(
  variant: DatabaseProduct["variants"][number],
): CatalogueVariant {
  return {
    id: variant.id,
    code: variant.code,
    supplierCode: variant.supplierCode || "",
    name: variant.name,
    label: variant.label || variant.name,
    priceHT: Number(variant.priceHt),
    delay: variant.leadTime || "",
    stock: variant.stock,
    weightKg: variant.weightKg === null ? null : Number(variant.weightKg),
    packageLengthCm: variant.packageLengthCm === null ? null : Number(variant.packageLengthCm),
    packageWidthCm: variant.packageWidthCm === null ? null : Number(variant.packageWidthCm),
    packageHeightCm: variant.packageHeightCm === null ? null : Number(variant.packageHeightCm),
    shippingMode: variant.shippingMode ?? undefined,
    imageRef: variant.imageReference || "",
    features: variant.features.map(mapFeature),
    options: asStringRecord(variant.options),
  };
}

function mapDatabaseProduct(product: DatabaseProduct): CatalogueProduct {
  const source = asRecord(product.sourceData) as SourceProductData;

  const categoryPath =
    source.categoryPath ||
    product.category?.path ||
    product.category?.name ||
    "";

  const categories = Array.isArray(source.categories)
    ? source.categories.filter(
        (item): item is string => typeof item === "string",
      )
    : categoryPath
        .split(/\|>/g)
        .map((item: string) => item.trim())
        .filter(Boolean);

  const variants = product.variants.map(mapVariant);

  const mapped: CatalogueProduct = {
    id: product.id,
    code: product.code,
    supplierCode: product.supplierCode || "",
    parentCode: product.parentCode || "",
    slug: product.slug,
    name: product.name,
    shortName: product.shortName || product.name,
    manufacturer: product.supplier?.name || source.manufacturer || "OYSTE",
    categorySlug: product.category?.slug || "",
    categoryPath,
    categories,
    description: product.description || "",
    detailedDescription: product.detailedDescription || "",
    seoTitle: product.seoTitle || undefined,
    seoDescription: product.seoDescription || undefined,
    media: product.media.map((media) => ({
      url: media.url,
      altText: media.altText,
      isPrimary: media.isPrimary,
      sortOrder: media.sortOrder,
    })),
    documents: product.documents.map((document) => ({
      name: document.name,
      type: document.type,
      url: document.url,
      isPublic: document.isPublic,
      sortOrder: document.sortOrder,
    })),
    priceHT: Number(product.priceHt),
    minPriceHT: product.minPriceHt === null ? null : Number(product.minPriceHt),
    maxPriceHT: product.maxPriceHt === null ? null : Number(product.maxPriceHt),
    delay: product.leadTime || "",
    stock: product.stock,
    weightKg: product.weightKg === null ? null : Number(product.weightKg),
    packageLengthCm: product.packageLengthCm === null ? null : Number(product.packageLengthCm),
    packageWidthCm: product.packageWidthCm === null ? null : Number(product.packageWidthCm),
    packageHeightCm: product.packageHeightCm === null ? null : Number(product.packageHeightCm),
    shippingMode: product.shippingMode ?? undefined,
    imageRef: product.imageReference || "",
    features: product.features.map(mapFeature),
    variantCount: variants.length || 1,
    optionSchema: asOptionSchema(product.optionSchema),
    variants,
    href: source.href || "",
  };

  const categorySlug = getNormalizedCategorySlug(mapped);

  return {
    ...mapped,
    categorySlug,
    href: `/catalogue/${categorySlug}/${product.slug}`,
  };
}


function normalizeFamilyText(value: string) {
  return value
    .replace(/\s+/g, " ")
    .replace(/\s+([,;:])/g, "$1")
    .trim();
}

function tokenizeFamilyText(value: string) {
  return normalizeFamilyText(value)
    .split(/\s+/)
    .filter(Boolean);
}

function commonTokenPrefix(values: string[]) {
  if (!values.length) return [];
  const tokenized = values.map(tokenizeFamilyText);
  const shortest = Math.min(...tokenized.map((tokens) => tokens.length));
  const prefix: string[] = [];

  for (let index = 0; index < shortest; index += 1) {
    const candidate = tokenized[0][index];
    if (
      tokenized.every(
        (tokens) =>
          tokens[index]?.localeCompare(candidate, "fr", { sensitivity: "base" }) === 0,
      )
    ) {
      prefix.push(candidate);
      continue;
    }
    break;
  }

  return prefix;
}

function cleanOptionLabel(value: string) {
  const cleaned = value
    .replace(/[,:;]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned
    ? `${cleaned.charAt(0).toUpperCase()}${cleaned.slice(1)}`
    : "Configuration";
}

function singularizeFrenchNoun(value: string) {
  const cleaned = value.replace(/[,:;]+$/g, "").trim().toLowerCase();
  if (cleaned.endsWith("aux")) return `${cleaned.slice(0, -3)}al`;
  if (cleaned.endsWith("s") && cleaned.length > 3) return cleaned.slice(0, -1);
  return cleaned;
}

function extractLabeledTechnicalOptions(text: string) {
  const options: Record<string, string> = {};

  // Les expressions ci-dessous sont génériques : elles décrivent la structure
  // d'une caractéristique (libellé + valeur/unité), pas une famille Stockman.
  const mast = text.match(/\bm[aâ]t\s+(duplex|triplex|simplex)(?:\s+([^,;]+?))?(?=,|;|\blev[eé]e\b|\bbatterie\b|$)/i);
  if (mast) {
    const qualifier = mast[2]?.trim();
    options["Mât"] = cleanOptionLabel(
      qualifier ? `${mast[1]} ${qualifier}` : mast[1],
    );
  }

  const lift = text.match(/\blev[eé]e(?:\s+(?:standard|utile))?\s+(\d{3,5})\s*mm\b/i);
  if (lift) options["Levée"] = `${lift[1]} mm`;

  const battery = text.match(/\bbatterie(?:\s+\w+)?\s+(\d{2,4})\s*Ah\b/i);
  if (battery) options["Batterie"] = `${battery[1]} Ah`;

  return options;
}

function extractCountAndQualifierOptions(variableText: string) {
  const options: Record<string, string> = {};
  const text = normalizeFamilyText(variableText)
    .replace(/^[,;:\-–—]+/, "")
    .trim();

  // Structure générique "2 timons renforcés", "4 roues pivotantes",
  // "1 plateau grillagé", etc. On transforme le nombre en une dimension et
  // l'adjectif/qualificatif en une autre dimension sans connaître la famille.
  const countMatch = text.match(
    /^(\d+)\s+([A-Za-zÀ-ÖØ-öø-ÿ'-]+)(?:\s+([A-Za-zÀ-ÖØ-öø-ÿ'-]+))?(?=\s|,|;|$)/,
  );

  if (!countMatch) return options;

  const count = countMatch[1];
  const rawNoun = countMatch[2];
  const qualifier = countMatch[3];
  const noun = singularizeFrenchNoun(rawNoun);

  options[`Nombre de ${noun}${Number(count) > 1 ? "s" : ""}`] =
    `${count} ${rawNoun}`;

  if (qualifier) {
    options[`Type de ${noun}`] = cleanOptionLabel(qualifier);
  }

  return options;
}

function stripCommonPrefix(designation: string, prefixTokens: string[]) {
  const tokens = tokenizeFamilyText(designation);
  if (!prefixTokens.length) return normalizeFamilyText(designation);
  return normalizeFamilyText(tokens.slice(prefixTokens.length).join(" "));
}

function stockmanFamilyOptions(
  designation: string,
  commonPrefixTokens: string[],
) {
  const text = normalizeFamilyText(designation);
  const variableText = stripCommonPrefix(text, commonPrefixTokens);

  const options: Record<string, string> = {
    ...extractLabeledTechnicalOptions(text),
    ...extractCountAndQualifierOptions(variableText),
  };

  // Filet de sécurité réellement générique : si aucune dimension structurée n'a
  // pu être déduite mais que les désignations diffèrent, la partie variable de la
  // désignation devient une option "Configuration". On garde ainsi une famille
  // navigable sans coder de règle spéciale fournisseur.
  if (!Object.keys(options).length && variableText && variableText !== text) {
    options.Configuration = cleanOptionLabel(variableText);
  }

  return options;
}

function normalizeSchemaLabel(label: string) {
  // Les familles peuvent produire "Nombre de timon" pour une ligne et
  // "Nombre de timons" pour une autre. On homogénéise les dimensions.
  return label
    .replace(/^Nombre de (.+?)s?$/i, (_, noun: string) => `Nombre de ${singularizeFrenchNoun(noun)}s`)
    .replace(/^Type de (.+?)s?$/i, (_, noun: string) => `Type de ${singularizeFrenchNoun(noun)}`)
    .trim();
}

function buildFamilyOptionSchema(variants: CatalogueVariant[]): CatalogueOption[] {
  const values = new Map<string, Set<string>>();

  for (const variant of variants) {
    const normalizedOptions: Record<string, string> = {};
    for (const [rawLabel, value] of Object.entries(variant.options || {})) {
      if (!rawLabel || !value) continue;
      const label = normalizeSchemaLabel(rawLabel);
      normalizedOptions[label] = value;
      if (!values.has(label)) values.set(label, new Set());
      values.get(label)?.add(value);
    }
    variant.options = normalizedOptions;
  }

  const preferredOrder = [
    "Mât",
    "Levée",
    "Batterie",
    "Configuration",
  ];

  return Array.from(values.entries())
    // Une dimension identique sur toutes les références n'est pas un choix.
    .filter(([, set]) => set.size > 1)
    .map(([label, set]) => ({ label, values: Array.from(set) }))
    .sort((a, b) => {
      const ai = preferredOrder.indexOf(a.label);
      const bi = preferredOrder.indexOf(b.label);
      const aRank = ai < 0 ? 50 : ai;
      const bRank = bi < 0 ? 50 : bi;
      return aRank - bRank || a.label.localeCompare(b.label, "fr");
    });
}

function keepOnlySchemaOptions(
  variants: CatalogueVariant[],
  schema: CatalogueOption[],
) {
  const labels = new Set(schema.map((option) => option.label));
  return variants.map((variant) => ({
    ...variant,
    options: Object.fromEntries(
      Object.entries(variant.options || {}).filter(([label]) => labels.has(label)),
    ),
  }));
}

export async function getDatabaseStockmanFamilyVariants(productId: string): Promise<{
  variants: CatalogueVariant[];
  optionSchema: CatalogueOption[];
}> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      code: true,
      supplierCode: true,
      name: true,
      priceHt: true,
      stock: true,
      weightKg: true,
      shippingMode: true,
      leadTime: true,
      imageReference: true,
      sourceData: true,
    },
  });

  if (!product) return { variants: [], optionSchema: [] };

  const source = asRecord(product.sourceData);
  const stockman = asRecord((source.stockman as Prisma.JsonValue | null) ?? null);
  const sourceUrl = typeof stockman.sourceUrl === "string" ? stockman.sourceUrl.trim() : "";
  if (!sourceUrl) return { variants: [], optionSchema: [] };

  const drafts = await prisma.stockmanImportDraft.findMany({
    where: { sourceUrl },
    orderBy: { reference: "asc" },
  });

  if (drafts.length <= 1) return { variants: [], optionSchema: [] };

  const commonPrefixTokens = commonTokenPrefix(
    drafts.map((draft) => draft.designation),
  );

  const references = drafts.map((draft) => draft.reference.trim()).filter(Boolean);
  const products = await prisma.product.findMany({
    where: {
      OR: [
        { supplierCode: { in: references } },
        { code: { in: references } },
      ],
    },
    select: {
      id: true,
      code: true,
      supplierCode: true,
      name: true,
      priceHt: true,
      stock: true,
      weightKg: true,
      shippingMode: true,
      leadTime: true,
      imageReference: true,
    },
  });

  const byReference = new Map<string, (typeof products)[number]>();
  for (const sibling of products) {
    byReference.set(sibling.code.trim().toUpperCase(), sibling);
    if (sibling.supplierCode) {
      byReference.set(sibling.supplierCode.trim().toUpperCase(), sibling);
    }
  }

  const variants: CatalogueVariant[] = drafts.map((draft) => {
    const reference = draft.reference.trim();
    const existing = byReference.get(reference.toUpperCase());
    const options = stockmanFamilyOptions(
      draft.designation,
      commonPrefixTokens,
    );

    return {
      id: existing?.id || `stockman-family-${reference}`,
      code: reference,
      supplierCode: reference,
      name: existing?.name || draft.designation,
      label: draft.designation,
      priceHT: existing ? Number(existing.priceHt) : 0,
      delay: existing?.leadTime || "",
      stock: existing?.stock ?? draft.stock ?? 0,
      weightKg: existing?.weightKg === null || existing?.weightKg === undefined
        ? (draft.weightKg === null ? null : Number(draft.weightKg))
        : Number(existing.weightKg),
      shippingMode: existing?.shippingMode ?? "QUOTE",
      imageRef: existing?.imageReference || reference,
      features: [],
      options,
    };
  });

  const uniqueVariants = Array.from(
    new Map(variants.map((variant) => [variant.code.toUpperCase(), variant])).values(),
  );

  const optionSchema = buildFamilyOptionSchema(uniqueVariants);

  return {
    variants: keepOnlySchemaOptions(uniqueVariants, optionSchema),
    optionSchema,
  };
}

export async function getDatabaseProductsByCategory(
  categorySlug: string,
  familySlug?: string,
): Promise<CatalogueProduct[]> {
  const normalizedSlug = normalizeCategoryQuery(categorySlug);

  // Les slugs issus de l'ancien import ne correspondent pas toujours à la
  // catégorie commerciale affichée sur le site. Par exemple, certains produits
  // dont le chemin commence par `Levage\...` ont été enregistrés sous
  // `palans-palonniers`, `portiques` ou `manutention-au-sol`. Il faut donc
  // mapper les produits avant de filtrer sur la catégorie normalisée.
  const products = await prisma.product.findMany({
    where: {
      publicationStatus: "PUBLISHED",
    },
    include: catalogueProductInclude,
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  const databaseProducts = products
    .map(mapDatabaseProduct)
    .filter((product) => product.categorySlug === normalizedSlug);

  // Les potences configurables sont volontairement exclues de l'import ERP.
  // Leurs fiches virtuelles doivent néanmoins rester visibles dans le catalogue.
  const virtualProducts = getProductsByCategory(normalizedSlug).filter((product) =>
    product.id.startsWith("virtual-"),
  );
  const knownSlugs = new Set(databaseProducts.map((product) => product.slug));
  const mergedProducts = [
    ...databaseProducts,
    ...virtualProducts.filter((product) => !knownSlugs.has(product.slug)),
  ];

  return filterProductsByFamily(mergedProducts, familySlug);
}

export async function getDatabaseProductBySlug(
  categorySlug: string,
  productSlug: string,
): Promise<CatalogueProduct | undefined> {
  const product = await prisma.product.findUnique({
    where: {
      slug: productSlug,
    },
    include: catalogueProductInclude,
  });

  if (!product || product.publicationStatus !== "PUBLISHED") {
    const virtualProduct = getProductBySlug(categorySlug, productSlug);
    return virtualProduct?.id.startsWith("virtual-") ? virtualProduct : undefined;
  }

  const mapped = mapDatabaseProduct(product);
  const requestedCategory = normalizeCategoryQuery(categorySlug);

  // Compatibilité avec les liens d'aperçu générés avant que la catégorie
  // Stockman soit matérialisée. Ces liens utilisaient `/catalogue/produit/...`.
  // On laisse la fiche se résoudre par son slug, puis la page redirige vers
  // l'URL canonique correspondant à la vraie catégorie.
  if (requestedCategory === "produit") {
    return mapped;
  }

  return mapped.categorySlug === requestedCategory ? mapped : undefined;
}

export async function getDatabaseFeaturedProducts(
  limit = 6,
): Promise<CatalogueProduct[]> {
  const products = await prisma.product.findMany({
    where: {
      publicationStatus: "PUBLISHED",
    },
    include: catalogueProductInclude,
    orderBy: [{ featured: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
  });

  const mapped = products.map(mapDatabaseProduct);

  const priority = [
    "levage",
    "manutention-au-sol",
    "motorisation-sew",
    "stockage-emballage",
    "acces-hauteur",
  ];

  const selected = priority.flatMap((slug) =>
    mapped
      .filter((product: CatalogueProduct) => product.categorySlug === slug)
      .slice(0, 2),
  );

  return selected.slice(0, limit);
}
