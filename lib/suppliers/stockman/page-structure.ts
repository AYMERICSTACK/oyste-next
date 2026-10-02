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
  inHeaderOrFooter?: boolean;
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
  isPrimaryFamilyTable?: boolean;
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
  const markers: Array<{ pattern: RegExp; relationType: StockmanRelationType }> = [
    { pattern: /\baccessoires?\b/, relationType: "ACCESSORY" },
    { pattern: /\boptions?\b/, relationType: "OPTION" },
    { pattern: /\bpieces? detachees?\b/, relationType: "SPARE_PART" },
    { pattern: /consultez\s+egalement|recommended products?/, relationType: "RECOMMENDED_PRODUCT" },
  ];
  // All row-local badges outrank any enclosing section or breadcrumb.
  for (const [origin, values] of [["badge", row.badgeTexts], ["section", row.sectionLabels]] as const) {
    for (const marker of markers) {
      const label = containsExplicit([...values], marker.pattern);
      if (label) return { relationType: marker.relationType, confidence: "EXPLICIT", evidence: [`${origin}:${label}`] };
    }
  }
  const sparePartBreadcrumb = containsExplicit(context.breadcrumb, /\bpieces? detachees?\b/);
  if (sparePartBreadcrumb) return { relationType: "SPARE_PART", confidence: "STRUCTURAL", evidence: [`breadcrumb:${sparePartBreadcrumb}`] };

  if (row.isCommercialTable) {
    const sameAsFamily = Boolean(
      context.familyReference
      && row.reference.trim().toUpperCase() === context.familyReference.trim().toUpperCase(),
    );
    if (!sameAsFamily && !row.isPrimaryFamilyTable) return { relationType: "UNKNOWN", confidence: "UNKNOWN", evidence: ["commercial-table-without-family-scope"] };
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

  // Stockman uses the same `--TOKEN.aspx` shape for taxonomy pages and
  // commercial family pages. Numeric terminal tokens are taxonomy ids
  // (`--19.aspx`, `--162.aspx`), while a non-numeric terminal token is the
  // family/reference slug (`--CL.aspx`, `--P1604-05.aspx`). Classifying the
  // generic shape as FAMILY_PAGE makes category pages terminal PRODUCT nodes.
  const terminalToken = url.pathname.match(/--([^/]+)\.aspx$/i)?.[1] ?? null;
  if (terminalToken && !/^\d+$/.test(terminalToken)) return "FAMILY_PAGE";

  const taxonomyLevels = [...url.pathname.matchAll(/--\d+(?=\.aspx$|\/|$)/g)].length;
  if (taxonomyLevels >= 2) return "SUBCATEGORY";
  if (taxonomyLevels === 1) return "CATEGORY";

  if (/\/overview\.aspx$/i.test(url.pathname)
    && (url.searchParams.has("search") || url.searchParams.has("tsearch"))) {
    return "SUBCATEGORY";
  }

  // Explicit taxonomy routes above remain discoverable even in a global menu.
  if (/\/(?:login|connexion|contact|mentions-legales|conditions-generales|account|panier)\.aspx$/i.test(url.pathname)) return null;
  if (url.pathname === "/" || /^\/en\/?$/i.test(url.pathname) || /\/products\.aspx$/i.test(url.pathname)) return "BROWSE";
  // Keep structurally scoped nonstandard catalogue routes: dropping unknown
  // catalogue navigation would create false proof of exhaustiveness.
  if (!context.inHeaderOrFooter && /\.aspx$/i.test(url.pathname)
    && (context.inCatalogueNavigation || context.inProductCard || context.inBreadcrumb)) return "BROWSE";
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
