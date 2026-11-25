import config from "./commercial-categories.json";

export const stockmanCommercialCategories = config;
export const defaultStockmanCommercialScope = config.map(({ id }) => id);
const sourceHost = "www.stockman.fr";

export function stockmanCommercialLocation(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || ![sourceHost, "stockman.fr"].includes(url.hostname)) return null;
    const parts = url.pathname.split("/").filter(Boolean);
    if (/^(fr|en)$/i.test(parts[0] ?? "")) parts.shift();
    const root = parts[0]?.replace(/\.aspx$/i, "").toLowerCase();
    const category = config.find((item) => item.aliases.includes(root));
    if (!category) return null;
    const subcategory = parts[1]?.match(/--(\d+)(?:\.aspx)?$/i)?.[1];
    return { category, subcategory };
  } catch {
    return null;
  }
}

export function resolveStockmanCommercialScope(values: readonly string[]) {
  const requested = [...new Set(values)].sort();
  if (!requested.length) throw new Error("Sélectionnez au moins une catégorie STOCKMAN.");
  const sources = new Set<string>();
  const keys: string[] = [];
  for (const key of requested) {
    const [id, subcategory] = key.split(":");
    const category = config.find((item) => item.id === id);
    const branch = subcategory === undefined ? category : category?.subcategories.find((item) => item.id === subcategory);
    if (!branch || key !== (subcategory === undefined ? id : id + ":" + subcategory)) throw new Error("Périmètre STOCKMAN inconnu.");
    if (subcategory !== undefined && requested.includes(id)) continue;
    keys.push(key);
    for (const source of branch.sources) sources.add(source);
    if (subcategory === undefined) {
      for (const child of category?.subcategories ?? []) for (const source of child.sources) sources.add(source);
    }
  }
  return { keys, sources: [...sources] };
}

export function isInStockmanCommercialScope(value: string, keys: readonly string[]) {
  const location = stockmanCommercialLocation(value);
  if (!location) return false;
  const { category, subcategory } = location;
  return keys.includes(category.id) || (subcategory !== undefined && keys.includes(category.id + ":" + subcategory));
}

export function normalizeStockmanCommercialExclusions(values: readonly string[]) {
  return [...new Set(values.map((value) => value.trim().toUpperCase()).filter(Boolean))].sort();
}
