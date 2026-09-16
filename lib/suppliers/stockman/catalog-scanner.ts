import type { Page } from "playwright";
import { isKnownFalseStockmanReference } from "@/lib/suppliers/stockman/reference-hygiene";
import { openStockmanBrowser } from "@/lib/suppliers/stockman/browser";

const STOCKMAN_HOST = /(^|\.)stockman\.fr$/i;
const REFERENCE_RE = /^[A-Z0-9][A-Z0-9./_-]{1,30}$/;
const EXCLUDED_PATHS = /connexion|contact|actualites|catalogues?|video|piece[s-]?detachee|mentions|condition|recrutement|devenir-revendeur/i;
const COMMERCIAL_MARKER_RE = /Poids\s*:|Catalogue\b|€\s*HT|Prix\s+Unitaire\s+HT|Code[- ]?barres?|Stock\b/i;
const REFERENCE_LABEL_RE = /(?:réf(?:érence)?|ref)\s*[:.]?\s*([A-Z0-9][A-Z0-9./_-]{1,30})/i;
const REFERENCE_STOPWORDS = new Set([
  "POIDS", "CATALOGUE", "STOCK", "PRIX", "UNITAIRE", "HT", "TTC", "CODE", "BARRES", "REFERENCE", "RÉFÉRENCE",
  "PRODUIT", "PRODUITS", "DISPONIBLE", "DISPONIBLES", "QUANTITE", "QUANTITÉ", "AJOUTER", "PANIER", "VOIR", "DETAIL",
  "DÉTAIL", "CARACTERISTIQUES", "CARACTÉRISTIQUES", "DESCRIPTION", "MARQUE", "CONDITIONNEMENT", "LIVRAISON", "PROMOTION",
]);

export type StockmanDiscoveredReference = {
  reference: string;
  designation: string;
  sourceUrl: string;
  category: string | null;
};

export type StockmanCatalogScanDiagnostics = {
  productLinksCollected: number;
  uniqueProductUrls: number;
  productPageAttempts: number;
  productPagesOpened: number;
  productPageFailures: number;
  productPageRedirects: number;
  productPagesWithReferences: number;
  productPagesWithoutReferences: number;
  extractedOccurrences: number;
  duplicateReferences: number;
  extractedFromRows: number;
  extractedFromBody: number;
  noReferenceSamples: string[];
  failedPageSamples: string[];
  browseQueueRemaining: number;
  browseLimitReached: boolean;
  productLimitReached: boolean;
  scanComplete: boolean;
};

export type StockmanCatalogScan = {
  startedAt: string;
  finishedAt: string;
  pagesVisited: number;
  productPages: number;
  references: StockmanDiscoveredReference[];
  diagnostics: StockmanCatalogScanDiagnostics;
  warnings: string[];
};

export type StockmanCatalogScanProgress = {
  phase: "catalogue" | "products";
  pagesVisited: number;
  productUrlsFound: number;
  productPagesProcessed: number;
  referencesFound: number;
  failures: number;
};

function normalizeUrl(value: string, base: string) {
  try {
    const url = new URL(value, base);
    if (!STOCKMAN_HOST.test(url.hostname) || !/^https?:$/.test(url.protocol)) return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function looksLikeProductUrl(value: string) {
  const url = new URL(value);
  return /\.aspx$/i.test(url.pathname) && /--[^/]+\.aspx$/i.test(url.pathname) && !EXCLUDED_PATHS.test(url.pathname);
}

function looksLikeBrowseUrl(value: string) {
  const url = new URL(value);
  if (EXCLUDED_PATHS.test(url.pathname)) return false;

  // V2.12.3 — Stockman utilise massivement overview.aspx?search=... comme
  // pages de famille / résultats. L'ancien filtre ne les suivait pas lorsque
  // le terme de recherche (cerclage, vérin, cric, etc.) n'était pas dans la
  // petite whitelist métier, ce qui rendait le scan non exhaustif.
  if (/\/overview\.aspx$/i.test(url.pathname) && (url.searchParams.has("search") || url.searchParams.has("tsearch"))) {
    return true;
  }

  return url.pathname === "/"
    || /produit|nouveaute|destockage|manutention|levage|stockage|rouleur|chariot|palan|table|convoyeur|emballage|cerclage|cric|verin|vérin|acces|accès|escabeau|marchepied/i.test(url.pathname + url.search);
}

function clean(value: string) {
  return value.replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ").trim();
}

function cleanReferenceToken(value: string) {
  return value
    .replace(/^[\s([{"'«]+/, "")
    .replace(/[\s)\]};,"'»]+$/, "")
    .replace(/[,:;]+$/, "")
    .toUpperCase();
}

function isPlausibleReference(value: string, original = value, _explicitlyLabelled = false) {
  const candidate = cleanReferenceToken(value);
  if (!REFERENCE_RE.test(candidate) || REFERENCE_STOPWORDS.has(candidate) || isKnownFalseStockmanReference(candidate)) return false;
  if (/^\d+(?:[.,]\d+)?$/.test(candidate)) return false;
  if (/^\d+(?:KG|G|MM|CM|M|€)$/.test(candidate)) return false;

  const hasDigit = /\d/.test(candidate);
  const hasLetter = /[A-Z]/.test(candidate);
  const hasSeparator = /[./_-]/.test(candidate);
  if (hasDigit && (hasLetter || hasSeparator)) return true;
  if (hasSeparator && hasLetter) return true;

  // Certaines références Stockman sont uniquement alphabétiques. On ne les
  // accepte que lorsqu'elles sont réellement écrites en capitales dans la page.
  return hasLetter
    && !hasDigit
    && candidate.length >= 3
    && candidate.length <= 12
    && cleanReferenceToken(original) === original.trim()
    && original.trim() === original.trim().toUpperCase();
}

function candidateScore(candidate: string, original: string, position: number, text: string) {
  let score = 0;
  if (/\d/.test(candidate) && /[A-Z]/.test(candidate)) score += 8;
  if (/[./_-]/.test(candidate)) score += 4;
  if (position === 0) score += 5;
  else if (position <= 2) score += 3;
  if (original === original.toUpperCase()) score += 2;
  if (new RegExp(`(?:réf(?:érence)?|ref)\\s*[:.]?\\s*${escapeRegExp(candidate)}`, "i").test(text)) score += 10;
  return score;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function bestReferenceFromText(value: string) {
  const text = clean(value);
  if (!text || !COMMERCIAL_MARKER_RE.test(text)) return null;

  const labelled = text.match(REFERENCE_LABEL_RE)?.[1];
  if (labelled && isPlausibleReference(labelled, labelled, true)) return cleanReferenceToken(labelled);

  const tokens = text.split(/\s+/).slice(0, 20);
  const candidates = tokens
    .map((original, position) => ({ original, position, candidate: cleanReferenceToken(original) }))
    .filter((item) => isPlausibleReference(item.candidate, item.original))
    .map((item) => ({ ...item, score: candidateScore(item.candidate, item.original, item.position, text) }))
    .sort((a, b) => b.score - a.score || a.position - b.position);

  return candidates[0]?.candidate ?? null;
}


function referenceFromProductUrl(value: string) {
  try {
    const url = new URL(value);
    const file = url.pathname.split("/").pop() ?? "";
    const match = file.match(/--([A-Z0-9][A-Z0-9./_-]{1,30})\.aspx$/i);
    if (!match?.[1]) return null;
    const candidate = cleanReferenceToken(match[1]);
    return isPlausibleReference(candidate, candidate, true) ? candidate : null;
  } catch {
    return null;
  }
}

function isRetryableNavigationError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /interrupted by another navigation|navigation.+interrupted|timeout .* exceeded/i.test(message);
}

async function gotoStockmanPage(page: Page, url: string, timeout = 45_000) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout });
      await page.waitForTimeout(attempt === 1 ? 650 : 900);
      return;
    } catch (error) {
      lastError = error;
      if (!isRetryableNavigationError(error) || attempt === 3) break;
      await page.waitForTimeout(500 * attempt);
      await page.goto("about:blank", { waitUntil: "domcontentloaded", timeout: 10_000 }).catch(() => undefined);
    }
  }
  throw lastError;
}

function designationAfter(lines: string[], index: number) {
  return lines.slice(index + 1, index + 7).find((line) =>
    line.length > 7
    && !/^poids\s*:/i.test(line)
    && !/^code[- ]?barres?\s*:/i.test(line)
    && !/^catalogue\b/i.test(line)
    && !/^\d+(?:[.,]\d+)?\s*€/.test(line)
    && !/^stock$/i.test(line)
    && !/^prix/i.test(line),
  ) ?? "Référence Stockman";
}

function designationFromBlock(value: string, reference: string) {
  const text = clean(value);
  const withoutReference = clean(text.replace(new RegExp(`^\\s*${escapeRegExp(reference)}\\b[\\s:;·-]*`, "i"), ""));
  const beforeCommercialData = clean(withoutReference.split(/\b(?:Poids\s*:|Prix\s+Unitaire\s+HT|Code[- ]?barres?\s*:|\d+(?:[.,]\d+)?\s*€\s*HT)\b/i)[0] ?? "");
  return beforeCommercialData.length > 7 ? beforeCommercialData.slice(0, 220) : "Référence Stockman";
}

type StockmanCommercialRow = {
  reference: string;
  text: string;
};

function extractReferencesFromRows(rows: StockmanCommercialRow[], sourceUrl: string, category: string | null) {
  const results: StockmanDiscoveredReference[] = [];
  for (const row of rows) {
    const text = clean(row.text);
    const reference = cleanReferenceToken(row.reference);
    if (!isPlausibleReference(reference, reference, true)) continue;
    results.push({
      reference,
      designation: designationFromBlock(text, reference),
      sourceUrl,
      category,
    });
  }
  return results;
}

function extractReferencesFromBody(bodyText: string, sourceUrl: string, category: string | null) {
  const lines = bodyText.split(/\r?\n/).map(clean).filter(Boolean);
  const results: StockmanDiscoveredReference[] = [];

  // Stratégie historique : référence sur sa propre ligne.
  for (let index = 0; index < lines.length; index += 1) {
    const original = lines[index];
    const candidate = cleanReferenceToken(original);
    if (!isPlausibleReference(candidate, original)) continue;
    const nearby = lines.slice(index, index + 10).join(" ");
    if (!COMMERCIAL_MARKER_RE.test(nearby)) continue;
    results.push({
      reference: candidate,
      designation: designationAfter(lines, index),
      sourceUrl,
      category,
    });
  }

  // Stratégie V2.4 : les variantes peuvent être aplaties dans une ligne ou
  // séparées de leur prix/stock. Chaque zone commerciale cherche donc sa
  // référence dans une petite fenêtre autour de la ligne concernée.
  for (let index = 0; index < lines.length; index += 1) {
    if (!COMMERCIAL_MARKER_RE.test(lines[index])) continue;
    const start = Math.max(0, index - 5);
    const end = Math.min(lines.length, index + 5);
    const window = lines.slice(start, end).join(" ");
    const reference = bestReferenceFromText(window);
    if (!reference) continue;
    results.push({
      reference,
      designation: designationFromBlock(window, reference),
      sourceUrl,
      category,
    });
  }

  return results;
}

function deduplicatePageReferences(items: StockmanDiscoveredReference[]) {
  const unique = new Map<string, StockmanDiscoveredReference>();
  for (const item of items) {
    const current = unique.get(item.reference);
    if (!current || current.designation === "Référence Stockman") unique.set(item.reference, item);
  }
  return [...unique.values()];
}

async function linksFrom(page: Page) {
  return page.locator("a[href]").evaluateAll((anchors: Element[]) => anchors.map((anchor: Element) => ({
    href: (anchor as HTMLAnchorElement).href,
    text: (anchor.textContent ?? "").trim(),
  })));
}

async function commercialRows(page: Page): Promise<StockmanCommercialRow[]> {
  // V2.12.8.2 — source stricte : une variante n'est retenue que si Stockman
  // l'expose dans une vraie ligne commerciale avec son champ `ref_article`.
  // Les <article>/<li> et paragraphes SEO ne sont plus parcourus : des mots
  // comme COMPARTIMENTS., FIXE. ou INTERNE. ne peuvent donc plus devenir des
  // références fournisseur.
  return page.locator("tr").evaluateAll((elements: Element[]) => {
    const seen = new Set<string>();
    const rows: Array<{ reference: string; text: string }> = [];
    for (const element of elements) {
      const referenceElement = element.querySelector(
        ".ref_article, [id*='rp_articles_ref_article']",
      );
      const reference = (referenceElement?.textContent ?? "").replace(/\u00a0/g, " ").trim();
      const text = (element.textContent ?? "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
      if (!reference || !text) continue;
      if (!/(?:Poids\s*:|Weight\s*:|Catalogue\b|€\s*HT|Prix\s+Unitaire\s+HT|Unit price|Code[- ]?barres?|Bar code|Stock\b)/i.test(text)) continue;
      const key = `${reference}::${text}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({ reference, text });
    }
    return rows;
  });
}

export async function scanStockmanCatalog(options?: {
  seedUrl?: string;
  maxBrowsePages?: number;
  maxProductPages?: number;
  onProgress?: (progress: StockmanCatalogScanProgress) => void | Promise<void>;
}): Promise<StockmanCatalogScan> {
  const startedAt = new Date();
  const seedUrl = normalizeUrl(options?.seedUrl?.trim() || "https://www.stockman.fr/", "https://www.stockman.fr/");
  if (!seedUrl) throw new Error("L’URL de départ Stockman est invalide.");

  const maxBrowsePages = Math.min(Math.max(options?.maxBrowsePages ?? 120, 1), 500);
  const maxProductPages = Math.min(Math.max(options?.maxProductPages ?? 800, 1), 2_000);
  const { browser, context } = await openStockmanBrowser();
  const page = await context.newPage();
  const browseQueue = [seedUrl];
  const visited = new Set<string>();
  const productUrls = new Map<string, string | null>();
  let productLinksCollected = 0;
  const warnings: string[] = [];
  const reportProgress = async (progress: StockmanCatalogScanProgress) => {
    await options?.onProgress?.(progress);
  };

  try {
    while (browseQueue.length && visited.size < maxBrowsePages && productUrls.size < maxProductPages) {
      const current = browseQueue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);
      try {
        await gotoStockmanPage(page, current);
        const links = await linksFrom(page);
        for (const link of links) {
          const normalized = normalizeUrl(link.href, page.url());
          if (!normalized) continue;
          if (looksLikeProductUrl(normalized)) {
            productLinksCollected += 1;
            if (!productUrls.has(normalized)) productUrls.set(normalized, link.text || null);
          } else if (looksLikeBrowseUrl(normalized) && !visited.has(normalized) && browseQueue.length < maxBrowsePages * 3) {
            browseQueue.push(normalized);
          }
        }
      } catch (error) {
        warnings.push(`${current} · ${error instanceof Error ? error.message : "Lecture impossible"}`);
      }
      await reportProgress({
        phase: "catalogue",
        pagesVisited: visited.size,
        productUrlsFound: productUrls.size,
        productPagesProcessed: 0,
        referencesFound: 0,
        failures: warnings.length,
      });
    }

    const discovered = new Map<string, StockmanDiscoveredReference>();
    let productPages = 0;
    let productPageAttempts = 0;
    let productPagesOpened = 0;
    let productPageFailures = 0;
    let productPageRedirects = 0;
    let productPagesWithReferences = 0;
    let productPagesWithoutReferences = 0;
    let extractedOccurrences = 0;
    let duplicateReferences = 0;
    let extractedFromRows = 0;
    let extractedFromBody = 0;
    const noReferenceSamples: string[] = [];
    const failedPageSamples: string[] = [];

    for (const [productUrl, category] of productUrls) {
      if (productPages >= maxProductPages) break;
      productPages += 1;
      productPageAttempts += 1;
      try {
        await gotoStockmanPage(page, productUrl);

        const finalUrl = page.url();
        if (finalUrl !== productUrl) productPageRedirects += 1;

        const bodyText = await page.locator("body").innerText();
        const appearsLoggedOut = /(?:se connecter|connexion|identifiez-vous|mot de passe)/i.test(bodyText)
          && !/Déconnexion/i.test(bodyText)
          && !COMMERCIAL_MARKER_RE.test(bodyText);
        if (appearsLoggedOut) {
          throw new Error("Session revendeur inactive : la fiche a redirigé ou affiche l'écran de connexion.");
        }

        productPagesOpened += 1;
        const rowItems = extractReferencesFromRows(await commercialRows(page), finalUrl, category);
        const urlReference = referenceFromProductUrl(finalUrl);
        const urlItems: StockmanDiscoveredReference[] = urlReference ? [{
          reference: urlReference,
          designation: designationFromBlock(bodyText.slice(0, 1_800), urlReference),
          sourceUrl: finalUrl,
          category,
        }] : [];
        extractedFromRows += rowItems.length;

        // V2.10.17.5 : l'intranet est la seule source de vérité.
        // On conserve la référence famille portée par l'URL et UNIQUEMENT les
        // références réellement présentes dans les lignes commerciales.
        // Plus aucune extraction du body : MINI/MAXI, ENCOMBRANTES, textes de
        // caractéristiques ou menus ne peuvent devenir des références catalogue.
        const pageItems = deduplicatePageReferences([...urlItems, ...rowItems])
          .filter((item) => !isKnownFalseStockmanReference(item.reference));
        extractedOccurrences += pageItems.length;

        if (pageItems.length) {
          productPagesWithReferences += 1;
        } else {
          productPagesWithoutReferences += 1;
          if (noReferenceSamples.length < 12) noReferenceSamples.push(page.url());
        }

        for (const item of pageItems) {
          if (discovered.has(item.reference)) {
            duplicateReferences += 1;
            continue;
          }
          discovered.set(item.reference, item);
        }
      } catch (error) {
        productPageFailures += 1;
        const message = error instanceof Error ? error.message : "Lecture impossible";
        warnings.push(`${productUrl} · ${message}`);
        if (failedPageSamples.length < 12) failedPageSamples.push(`${productUrl} · ${message}`);
      }
      await reportProgress({
        phase: "products",
        pagesVisited: visited.size,
        productUrlsFound: productUrls.size,
        productPagesProcessed: productPageAttempts,
        referencesFound: discovered.size,
        failures: productPageFailures,
      });
    }

    if (productPageFailures > 0) {
      warnings.unshift(
        `Diagnostic V2.4.1 : ${productPageFailures}/${productPageAttempts} ouverture(s) de fiche ont échoué.`,
      );
    }

    if (productPagesWithoutReferences > 0) {
      warnings.unshift(
        `Diagnostic V2.4 : ${productPagesWithoutReferences}/${productPages} fiche(s) parcourue(s) n'ont livré aucune référence exploitable.`,
      );
    }

    const browseQueueRemaining = browseQueue.length;
    const browseLimitReached = browseQueueRemaining > 0 && visited.size >= maxBrowsePages;
    const productLimitReached = productUrls.size >= maxProductPages || (productPages >= maxProductPages && productUrls.size > productPages);
    const scanComplete = !browseLimitReached && !productLimitReached && productPageFailures === 0;

    if (browseLimitReached) {
      warnings.unshift(
        `Audit exhaustivité V2.12.3 : plafond d'exploration atteint (${visited.size}/${maxBrowsePages}) avec ${browseQueueRemaining} page(s) encore en attente. Le scan n'est pas exhaustif.`,
      );
    }
    if (productLimitReached) {
      warnings.unshift(
        `Audit exhaustivité V2.12.3 : plafond de fiches atteint (${Math.min(productPages, maxProductPages)}/${maxProductPages}). Le scan n'est pas exhaustif.`,
      );
    }

    return {
      startedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
      pagesVisited: visited.size,
      productPages,
      references: [...discovered.values()].sort((a, b) => a.reference.localeCompare(b.reference, "fr")),
      diagnostics: {
        productLinksCollected,
        uniqueProductUrls: productUrls.size,
        productPageAttempts,
        productPagesOpened,
        productPageFailures,
        productPageRedirects,
        productPagesWithReferences,
        productPagesWithoutReferences,
        extractedOccurrences,
        duplicateReferences,
        extractedFromRows,
        extractedFromBody,
        noReferenceSamples,
        failedPageSamples,
        browseQueueRemaining,
        browseLimitReached,
        productLimitReached,
        scanComplete,
      },
      warnings: warnings.slice(0, 100),
    };
  } finally {
    await page.close().catch(() => undefined);
    await context.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
  }
}
