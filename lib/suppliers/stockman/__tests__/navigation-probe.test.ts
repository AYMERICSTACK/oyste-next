import assert from "node:assert/strict";
import test from "node:test";

import { navigationProbeConclusion, safeStockmanPath, stockmanFrenchUrl, type StockmanNavigationProbeResult } from "../navigation-probe";

function result(probe: StockmanNavigationProbeResult["probe"], status: number): StockmanNavigationProbeResult {
  return {
    probe,
    requestedPath: "/fixture",
    finalPath: status >= 400 ? "/404.aspx" : "/fixture",
    status,
    redirects: [],
    requestHeaders: { userAgent: null, acceptLanguage: null, secChUa: null },
    browser: { userAgent: null, language: null, platform: null, webdriver: null },
    cookies: { before: 0, after: 0, persistentBefore: 0, persistentAfter: 0, aspNetSessionBefore: false, aspNetSessionAfter: false },
    durationMs: 1,
    error: null,
  };
}

test("construit la variante française sans altérer les paramètres", () => {
  assert.equal(stockmanFrenchUrl("https://www.stockman.fr/catalogue/fiche.aspx?src=int"), "https://www.stockman.fr/fr/catalogue/fiche.aspx?src=int");
  assert.equal(stockmanFrenchUrl("https://www.stockman.fr/fr/catalogue/fiche.aspx"), "https://www.stockman.fr/fr/catalogue/fiche.aspx");
});

test("rejette les URL extérieures et masque les valeurs de query string", () => {
  assert.throws(() => stockmanFrenchUrl("https://example.com/product"));
  assert.equal(safeStockmanPath("https://www.stockman.fr/fr/product.aspx?src=int&token=secret"), "/fr/product.aspx?src&token");
  assert.equal(safeStockmanPath("https://example.com/product"), "[external]");
});

test("classe les trois résultats sans interprétation ambiguë", () => {
  assert.equal(navigationProbeConclusion([result("authenticated_exact", 500), result("authenticated_with_fr", 200), result("anonymous_with_fr", 200)]), "language_path");
  assert.equal(navigationProbeConclusion([result("authenticated_exact", 500), result("authenticated_with_fr", 500), result("anonymous_with_fr", 200)]), "authenticated_context");
  assert.equal(navigationProbeConclusion([result("authenticated_exact", 500), result("authenticated_with_fr", 500), result("anonymous_with_fr", 500)]), "vercel_or_browser");
});
