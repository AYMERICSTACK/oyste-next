export type StockmanRelationType =
  | "PRIMARY"
  | "PRIMARY_VARIANT"
  | "ACCESSORY"
  | "OPTION"
  | "RELATED_PRODUCT"
  | "RECOMMENDED_PRODUCT"
  | "SPARE_PART"
  | "UNKNOWN";

export type StockmanNavigationKind = "CATEGORY" | "SUBCATEGORY" | "FAMILY_PAGE" | "BROWSE";

export type StockmanLinkDomContext = {
  inCatalogueNavigation: boolean;
  inBreadcrumb: boolean;
  inProductCard: boolean;
  ancestorText: string;
  ancestorClass: string;
  dataAttributes: string[];
};

export type StockmanCommercialRowSnapshot = {
  reference: string;
  text: string;
  badgeTexts: string[];
  sectionLabels: string[];
  ancestorClass: string;
  dataAttributes: string[];
  isCommercialTable: boolean;
  rowIndex: number;
};

export type StockmanClassification = {
  relationType: StockmanRelationType;
  confidence: "EXPLICIT" | "STRUCTURAL" | "UNKNOWN";
  evidence: string[];
};

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function containsExplicit(values: string[], pattern: RegExp) {
  return values.find((value) => pattern.test(normalize(value))) ?? null;
}

export function classifyCommercialRow(
  row: StockmanCommercialRowSnapshot,
  context: { familyReference: string | null; breadcrumb: string[] },
): StockmanClassification {
  const accessoryBadge = containsExplicit(row.badgeTexts, /\baccessoires?\b/);
  if (accessoryBadge) {
    return { relationType: "ACCESSORY", confidence: "EXPLICIT", evidence: [`badge:${accessoryBadge}`] };
  }

  const optionBadge = containsExplicit(row.badgeTexts, /\boptions?\b/);
  const optionSection = containsExplicit(row.sectionLabels, /\boptions?\b/);
  if (optionBadge || optionSection) {
    return {
      relationType: "OPTION",
      confidence: "EXPLICIT",
      evidence: [optionBadge ? `badge:${optionBadge}` : `section:${optionSection}`],
    };
  }

  const sparePartBadge = containsExplicit(row.badgeTexts, /\bpieces? detachees?\b/);
  const sparePartSection = containsExplicit(row.sectionLabels, /\bpieces? detachees?\b/);
  const sparePartBreadcrumb = containsExplicit(context.breadcrumb, /\bpieces? detachees?\b/);
  if (sparePartBadge || sparePartSection || sparePartBreadcrumb) {
    const marker = sparePartBadge ?? sparePartSection ?? sparePartBreadcrumb;
    return { relationType: "SPARE_PART", confidence: "EXPLICIT", evidence: [`label:${marker}`] };
  }

  if (row.isCommercialTable) {
    const sameAsFamily = Boolean(
      context.familyReference
      && row.reference.trim().toUpperCase() === context.familyReference.trim().toUpperCase(),
    );
    return {
      relationType: sameAsFamily ? "PRIMARY" : "PRIMARY_VARIANT",
      confidence: "STRUCTURAL",
      evidence: ["commercial-table", sameAsFamily ? "reference-equals-family" : "reference-in-family-table"],
    };
  }

  return { relationType: "UNKNOWN", confidence: "UNKNOWN", evidence: ["no-explicit-structural-marker"] };
}

export function classifyStockmanNavigationLink(
  value: string,
  context: StockmanLinkDomContext,
): StockmanNavigationKind | null {
  const url = new URL(value);
  if (/--[^/]+\.aspx$/i.test(url.pathname)) return "FAMILY_PAGE";

  const taxonomyLevels = [...url.pathname.matchAll(/--\d+(?=\/|$)/g)].length;
  if (taxonomyLevels >= 2) return "SUBCATEGORY";
  if (taxonomyLevels === 1) return "CATEGORY";

  if (/\/overview\.aspx$/i.test(url.pathname)
    && (url.searchParams.has("search") || url.searchParams.has("tsearch"))) {
    return "SUBCATEGORY";
  }

  if (context.inCatalogueNavigation || context.inBreadcrumb || context.inProductCard) return "BROWSE";
  if (url.pathname === "/" || /\/products\.aspx$/i.test(url.pathname)) return "BROWSE";
  return null;
}

export function breadcrumbTaxonomy(breadcrumb: string[]) {
  const cleaned = breadcrumb.map((item) => item.replace(/\s+/g, " ").trim()).filter(Boolean);
  const withoutHome = cleaned.filter((item) => !/^(?:accueil|home|produits?|products?)$/i.test(item));
  return {
    category: withoutHome[0] ?? null,
    subcategory: withoutHome.length > 1 ? withoutHome.at(-1) ?? null : null,
  };
}

export function relationFromRelatedSection(label: string): "RECOMMENDED_PRODUCT" | null {
  return /consultez\s+[ée]galement/i.test(normalize(label)) ? "RECOMMENDED_PRODUCT" : null;
}
