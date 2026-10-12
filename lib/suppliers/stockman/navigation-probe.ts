const STOCKMAN_HOST = /(^|\.)stockman\.fr$/i;

export type StockmanNavigationProbeLabel =
  | "authenticated_exact"
  | "authenticated_with_fr"
  | "anonymous_with_fr";

export type StockmanNavigationProbeResult = {
  probe: StockmanNavigationProbeLabel;
  requestedPath: string;
  finalPath: string | null;
  status: number | null;
  redirects: Array<{ status: number; path: string; locationPath: string | null }>;
  requestHeaders: { userAgent: string | null; acceptLanguage: string | null; secChUa: string | null };
  browser: { userAgent: string | null; language: string | null; platform: string | null; webdriver: boolean | null };
  cookies: {
    before: number;
    after: number;
    persistentBefore: number;
    persistentAfter: number;
    aspNetSessionBefore: boolean;
    aspNetSessionAfter: boolean;
  };
  durationMs: number;
  error: "navigation_failed" | null;
};

export function stockmanFrenchUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:" || !STOCKMAN_HOST.test(url.hostname)) {
    throw new Error("L’URL de diagnostic doit appartenir à stockman.fr.");
  }
  if (!/^\/(?:fr|en)(?:\/|$)/i.test(url.pathname)) {
    url.pathname = `/fr${url.pathname.startsWith("/") ? "" : "/"}${url.pathname}`;
  }
  return url.toString();
}

export function safeStockmanPath(value: string, base?: string) {
  try {
    const url = new URL(value, base);
    if (!STOCKMAN_HOST.test(url.hostname)) return "[external]";
    const queryKeys = [...new Set([...url.searchParams.keys()])].sort();
    return `${url.pathname}${queryKeys.length ? `?${queryKeys.join("&")}` : ""}`;
  } catch {
    return "[invalid]";
  }
}

export function navigationProbeConclusion(results: StockmanNavigationProbeResult[]) {
  const byProbe = new Map(results.map((item) => [item.probe, item]));
  const exact = byProbe.get("authenticated_exact")?.status ?? null;
  const french = byProbe.get("authenticated_with_fr")?.status ?? null;
  const anonymous = byProbe.get("anonymous_with_fr")?.status ?? null;
  const ok = (status: number | null) => status !== null && status < 400;

  if (!ok(exact) && ok(french)) return "language_path" as const;
  if (!ok(french) && ok(anonymous)) return "authenticated_context" as const;
  if (!ok(exact) && !ok(french) && !ok(anonymous)) return "vercel_or_browser" as const;
  return "inconclusive" as const;
}
