const STOCKMAN_HOST = /(^|\.)stockman\.fr$/i;

const CONTEXT_ONLY_PARAMS = new Set([
  "langue",
  "language",
  "lang",
  "src",
  "gclid", "fbclid", "msclkid",
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
      if (CONTEXT_ONLY_PARAMS.has(key.toLowerCase()) && (!/^(langue|language|lang)$/i.test(key) || !/^\/en(?:\/|$)/i.test(url.pathname) && /^(fr|fr-fr|french|francais)$/i.test(value))) continue;
      if (/^utm_/i.test(key)) continue;
      retained.push([key, value]);
    }
    retained.sort(([leftKey, leftValue], [rightKey, rightValue]) =>
      leftKey.localeCompare(rightKey, "en", { sensitivity: "base" })
      || leftValue.localeCompare(rightValue, "en", { sensitivity: "base" })
      || leftKey.localeCompare(rightKey, "en") || leftValue.localeCompare(rightValue, "en"),
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

/** Candidate identity for diagnostics only: an id is not proof that two paths
 * expose identical catalogue contents. Queue dedupe uses the full canonical URL.
 */
export function stockmanTaxonomyIdentity(value: string) {
  const canonical = canonicalizeStockmanUrl(value);
  if (!canonical) return null;
  const url = new URL(canonical);
  const id = url.pathname.match(/--(\d+)\.aspx$/i)?.[1];
  if (!id) return canonical;
  const language = stockmanUrlLanguage(canonical);
  return `taxonomy:${language}:${id}${url.search}`;
}

export function stockmanUrlLanguage(value: string) {
  const url = new URL(value);
  const parameter = [...url.searchParams].find(([key]) => /^(langue|lang|language)$/i.test(key))?.[1];
  if (parameter && /^(en|en-gb|en-us|english)$/i.test(parameter)) return "en";
  if (parameter && /^(fr|fr-fr|french|francais)$/i.test(parameter)) return "fr";
  if (parameter) return "other";
  return /^\/en(?:\/|$)/i.test(url.pathname) ? "en" : "fr";
}

export function stockmanQueueIdentity(value: string) {
  return canonicalizeStockmanUrl(value);
}
