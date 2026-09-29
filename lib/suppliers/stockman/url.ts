const STOCKMAN_HOST = /(^|\.)stockman\.fr$/i;

const CONTEXT_ONLY_PARAMS = new Set([
  "langue",
  "language",
  "lang",
  "src",
]);

/**
 * Returns a stable identity for a Stockman resource.
 *
 * Only parameters observed as presentation/navigation context are removed.
 * Search, pagination, filters and every unknown parameter are deliberately
 * retained because they may alter catalogue contents.
 */
export function canonicalizeStockmanUrl(value: string, base = "https://www.stockman.fr/") {
  try {
    const url = new URL(value, base);
    if (!STOCKMAN_HOST.test(url.hostname) || !/^https?:$/.test(url.protocol)) return null;

    url.protocol = "https:";
    url.hostname = "www.stockman.fr";
    url.port = "";
    url.hash = "";

    url.pathname = url.pathname
      .replace(/\/{2,}/g, "/")
      .replace(/^\/fr(?=\/|$)/i, "") || "/";

    if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, "");

    const retained: Array<[string, string]> = [];
    for (const [rawKey, rawValue] of url.searchParams) {
      const key = rawKey.trim();
      const value = rawValue.trim();
      if (!key) continue;
      if (CONTEXT_ONLY_PARAMS.has(key.toLowerCase())) continue;
      retained.push([key, value]);
    }
    retained.sort(([leftKey, leftValue], [rightKey, rightValue]) =>
      leftKey.localeCompare(rightKey, "en", { sensitivity: "base" })
      || leftValue.localeCompare(rightValue, "en", { sensitivity: "base" }),
    );
    url.search = "";
    for (const [key, value] of retained) url.searchParams.append(key, value);

    return url.toString();
  } catch {
    return null;
  }
}

export function stockmanTaxonomyBranch(value: string) {
  try {
    const url = new URL(value);
    return url.pathname.match(/--(\d+)(?:\/|$)/)?.[1] ?? "root";
  } catch {
    return "root";
  }
}
