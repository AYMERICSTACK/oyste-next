/**
 * Audit-only, fail-closed semantic guard. A supplier family's URL is not proof
 * that the item is a standalone product of that family.
 * No database, network or session dependencies.
 */
export function normalizeStockmanLabel(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

const ACCESSORY_START = [
  "sangle de securite", "sangle pour", "extension de chassis", "roue de support",
  "roue avant", "roue arriere", "kit de", "piece detachee",
  "dispositif de levage electrique pour diables", "verins electriques pour diables",
  "porte bouteilles", "porte bouteilles double",
];
const REVIEW_START = [
  "echelle reglable", "chassis roulant", "manipulateur de portes",
];

export type StockmanDesignationKind = "accessory" | "review" | "unspecified";
export function stockmanDesignationKind(name: string): StockmanDesignationKind {
  const text = normalizeStockmanLabel(name);
  if (ACCESSORY_START.some((part) => text.startsWith(part))) return "accessory";
  if (REVIEW_START.some((part) => text.startsWith(part))) return "review";
  return "unspecified";
}

export function stockmanCategorySemanticVeto(name: string, targetPath: string | null): string | null {
  if (!targetPath) return null;
  const title = normalizeStockmanLabel(name);
  const target = normalizeStockmanLabel(targetPath);
  const kind = stockmanDesignationKind(name);
  if (kind !== "unspecified" && target.includes("diable")) {
    return kind === "accessory"
      ? "accessoire ou pièce associée : la rubrique fournisseur « diables » n'établit pas une catégorie produit"
      : "nature de produit différente ou ambiguë : vérification manuelle nécessaire";
  }
  if (target.includes("diable aluminium et inox")) {
    if (/\bacier\b/.test(title)) return "matière acier incompatible avec la catégorie aluminium et inox";
    if (!/\baluminium\b|\binox\b/.test(title)) {
      return "matière aluminium/inox non démontrée par la désignation";
    }
  }
  return null;
}
