import type { Page } from "playwright";
import { isKnownFalseStockmanReference } from "@/lib/suppliers/stockman/reference-hygiene";
import { openStockmanBrowser } from "@/lib/suppliers/stockman/browser";
import {
  breadcrumbTaxonomy,
  classifyCommercialRow,
  classifyStockmanNavigationLink,
  type StockmanCommercialRowSnapshot,
  type StockmanLinkDomContext,
  type StockmanNavigationKind,
  type StockmanRelationType,
} from "@/lib/suppliers/stockman/page-structure";
import { canonicalizeStockmanUrl, stockmanTaxonomyBranch } from "@/lib/suppliers/stockman/url";

const REFERENCE_RE = /^[A-Z0-9][A-Z0-9./_-]{1,30}$/;
const EXCLUDED_PATHS = /connexion|contact|actualites|catalogues?|video|mentions|condition|recrutement|devenir-revendeur/i;
const COMMERCIAL_MARKER_RE = /Poids\s*:|Catalogue\b|€\s*HT|Prix\s+Unitaire\s+HT|Code[- ]?barres?|Stock\b/i;
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
  subcategory: string | null;
  familyReference: string | null;
  familyTitle: string | null;
  relationType: StockmanRelationType;
  classificationConfidence: "EXPLICIT" | "STRUCTURAL" | "UNKNOWN";
  classificationEvidence: string[];
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
  queueLimitReached: boolean;
  discardedUrls: number;
  unvisitedUrls: number;
  navigationErrors: number;
  productErrors: number;
  canonicalizedUrls: number;
  duplicateUrlsAvoided: number;
  categoriesDiscovered: number;
  subcategoriesDiscovered: number;
  familiesDiscovered: number;
  primaryReferences: number;
  accessoryReferences: number;
  optionReferences: number;
  relatedProducts: number;
  unknownReferences: number;
  scanComplete: boolean;
};

export type StockmanProductPageTrace = {
  requestedUrl: string;
  finalUrl: string;
  discoveryLabel: string | null;
  title: string;
  heading: string;
  bodySample: string;
  breadcrumb: string[];
  category: string | null;
  subcategory: string | null;
  familyReference: string | null;
  familyTitle: string | null;
  commercialRows: Array<StockmanCommercialRowSnapshot & {
    relationType: StockmanRelationType;
    classificationEvidence: string[];
  }>;
  relatedProducts: Array<{ url: string; label: string; relationType: "RECOMMENDED_PRODUCT" }>;
  extractedReferences: string[];
};

export type StockmanProductLinkTrace = {
  sourcePageUrl: string;
  rawHref: string;
  normalizedUrl: string;
  canonicalUrl: string;
  anchorText: string;
  pathname: string;
  navigationKind: StockmanNavigationKind | null;
  acceptedAsProduct: boolean;
  acceptedAsBrowse: boolean;
  legacyReference: string | null;
  rejectionReason: string | null;
};

export type StockmanCatalogScan = {
  startedAt: string;
  finishedAt: string;
  pagesVisited: number;
  productPages: number;
  references: StockmanDiscoveredReference[];
  pageTraces: StockmanProductPageTrace[];
  productLinkTraces: StockmanProductLinkTrace[];
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

function looksLikeProductUrl(value: string) {
  const url = new URL(value);
  return /\.aspx$/i.test(url.pathname) && /--[^/]+\.aspx$/i.test(url.pathname) && !EXCLUDED_PATHS.test(url.pathname);
}

function legacyReferenceFromProductUrl(value: string) {
  try {
    const url = new URL(value);
    const file = decodeURIComponent(url.pathname).split("/").pop() ?? "";
    const match = file.match(/__([A-Z0-9][A-Z0-9./_-]{1,30})\.aspx$/i);
    if (!match?.[1]) return null;
    const candidate = cleanReferenceToken(match[1]);
    return isPlausibleReference(candidate, candidate) ? candidate : null;
  } catch {
    return null;
  }
}

function productLinkRejectionReason(value: string, acceptedAsProduct: boolean, legacyReference: string | null) {
  if (acceptedAsProduct) return null;
  const url = new URL(value);
  if (EXCLUDED_PATHS.test(url.pathname)) return "Chemin exclu par EXCLUDED_PATHS";
  if (!/\.aspx$/i.test(url.pathname)) return "Le chemin ne se termine pas par .aspx";
  if (legacyReference) return `Format legacy __${legacyReference}.aspx non accepté par le filtre produit actuel (--REF.aspx attendu)`;
  if (!/--[^/]+\.aspx$/i.test(url.pathname)) return "Format URL non reconnu comme fiche produit (--REF.aspx attendu)";
  return "Lien non retenu comme fiche produit";
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

function isPlausibleReference(value: string, original = value) {
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

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function referenceFromProductUrl(value: string) {
  try {
    const url = new URL(value);
    const file = decodeURIComponent(url.pathname).split("/").pop() ?? "";
    const match = file.match(/--([A-Z0-9][A-Z0-9./_-]{1,30})\.aspx$/i);
    if (!match?.[1]) return null;
    const candidate = cleanReferenceToken(match[1]);
    return isPlausibleReference(candidate, candidate) ? candidate : null;
  } catch {
    return null;
  }
}

function isRetryableNavigationError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /interrupted by another navigation|navigation.+interrupted|timeout .* exceeded/i.test(message);
}

async function gotoStockmanPage(page: Page, url: string, timeout = 45_000, maxAttempts = 3) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout });
      await page.waitForTimeout(attempt === 1 ? 650 : 900);
      return;
    } catch (error) {
      lastError = error;
      if (!isRetryableNavigationError(error) || attempt === maxAttempts) break;
      await page.waitForTimeout(500 * attempt);
      await page.goto("about:blank", { waitUntil: "domcontentloaded", timeout: 10_000 }).catch(() => undefined);
    }
  }
  throw lastError;
}

function designationFromBlock(value: string, reference: string) {
  const text = clean(value);
  const withoutReference = clean(text.replace(new RegExp(`^\\s*${escapeRegExp(reference)}\\b[\\s:;·-]*`, "i"), ""));
  const beforeCommercialData = clean(withoutReference.split(/\b(?:Poids\s*:|Prix\s+Unitaire\s+HT|Code[- ]?barres?\s*:|\d+(?:[.,]\d+)?\s*€\s*HT)\b/i)[0] ?? "");
  return beforeCommercialData.length > 7 ? beforeCommercialData.slice(0, 220) : "Référence Stockman";
}

type StockmanFamilyContext = {
  sourceUrl: string;
  category: string | null;
  subcategory: string | null;
  familyReference: string | null;
  familyTitle: string | null;
  breadcrumb: string[];
};

export function extractReferencesFromStructuredRows(
  rows: StockmanCommercialRowSnapshot[],
  context: StockmanFamilyContext,
) {
  const results: StockmanDiscoveredReference[] = [];
  for (const row of rows) {
    const text = clean(row.text);
    const reference = cleanReferenceToken(row.reference);
    if (!isPlausibleReference(reference, reference)) continue;
    const classification = classifyCommercialRow(row, context);
    results.push({
      reference,
      designation: designationFromBlock(text, reference),
      sourceUrl: context.sourceUrl,
      category: context.category,
      subcategory: context.subcategory,
      familyReference: context.familyReference,
      familyTitle: context.familyTitle,
      relationType: classification.relationType,
      classificationConfidence: classification.confidence,
      classificationEvidence: classification.evidence,
    });
  }
  return results;
}

function deduplicatePageReferences(items: StockmanDiscoveredReference[]) {
  const unique = new Map<string, StockmanDiscoveredReference>();
  for (const item of items) {
    const current = unique.get(item.reference);
    if (!current
      || current.classificationConfidence === "UNKNOWN" && item.classificationConfidence !== "UNKNOWN"
      || current.designation === "Référence Stockman" && item.designation !== "Référence Stockman") {
      unique.set(item.reference, item);
    }
  }
  return [...unique.values()];
}

type BrowseNode = {
  url: string;
  kind: Exclude<StockmanNavigationKind, "FAMILY_PAGE">;
  branch: string;
};

class FairTaxonomyQueue {
  private readonly branches = new Map<string, BrowseNode[]>();
  private readonly branchOrder: string[] = [];
  private cursor = 0;
  private count = 0;

  get size() {
    return this.count;
  }

  push(node: BrowseNode) {
    let queue = this.branches.get(node.branch);
    if (!queue) {
      queue = [];
      this.branches.set(node.branch, queue);
      this.branchOrder.push(node.branch);
    }
    queue.push(node);
    this.count += 1;
  }

  shift() {
    if (!this.count) return null;
    for (let checked = 0; checked < this.branchOrder.length; checked += 1) {
      const index = this.cursor % this.branchOrder.length;
      this.cursor = (index + 1) % this.branchOrder.length;
      const branch = this.branchOrder[index];
      const queue = this.branches.get(branch);
      const node = queue?.shift();
      if (!node) continue;
      this.count -= 1;
      return node;
    }
    return null;
  }

  urls() {
    return [...this.branches.values()].flat().map((node) => node.url);
  }
}

async function linksFrom(page: Page) {
  return page.locator("a[href]").evaluateAll((anchors: Element[]) => anchors.map((anchor: Element) => ({
    href: (anchor as HTMLAnchorElement).href,
    rawHref: anchor.getAttribute("href") ?? "",
    text: (anchor.textContent ?? "").trim(),
    context: (() => {
      const owner = anchor.closest("nav, aside, .menu, .navigation, .content-ariane, #div_ariane_content, article, .product, .produit, [class*='product'], [class*='produit']");
      const dataAttributes = owner
        ? [...owner.attributes].filter((attribute) => attribute.name.startsWith("data-")).map((attribute) => `${attribute.name}=${attribute.value}`)
        : [];
      return {
        inCatalogueNavigation: Boolean(anchor.closest("aside, .menu, .navigation, [class*='catalogue'], [class*='category'], [class*='categorie']")),
        inBreadcrumb: Boolean(anchor.closest(".content-ariane, #div_ariane_content, [class*='breadcrumb']")),
        inProductCard: Boolean(anchor.closest("article, .product, .produit, [class*='product-card'], [class*='produit-card']")),
        ancestorText: (owner?.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 500),
        ancestorClass: owner?.getAttribute("class") ?? "",
        dataAttributes,
      } satisfies StockmanLinkDomContext;
    })(),
  })));
}

async function commercialRows(page: Page): Promise<StockmanCommercialRowSnapshot[]> {
  // V2.12.8.2 — source stricte : une variante n'est retenue que si Stockman
  // l'expose dans une vraie ligne commerciale avec son champ `ref_article`.
  // Les <article>/<li> et paragraphes SEO ne sont plus parcourus : des mots
  // comme COMPARTIMENTS., FIXE. ou INTERNE. ne peuvent donc plus devenir des
  // références fournisseur.
  return page.locator("tr").evaluateAll((elements: Element[]) => {
    const seen = new Set<string>();
    const rows: StockmanCommercialRowSnapshot[] = [];
    for (const [rowIndex, element] of elements.entries()) {
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
      const table = element.closest("table");
      const section = element.closest("section, article, fieldset, .bloc, .block, [class*='option'], [class*='accessoir'], [class*='piece']");
      const precedingHeadings = section
        ? [...section.querySelectorAll("h1, h2, h3, h4, legend")]
          .filter((heading) => Boolean(heading.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING))
          .map((heading) => heading.textContent ?? "")
        : [];
      const badgeTexts = [...element.querySelectorAll(".badge, .label, .tag, [class*='badge'], [class*='accessoir'], [class*='option']")]
        .map((badge) => (badge.textContent ?? "").replace(/\s+/g, " ").trim())
        .filter(Boolean);
      const owner = section ?? table ?? element;
      const dataAttributes = [...owner.attributes]
        .filter((attribute) => attribute.name.startsWith("data-"))
        .map((attribute) => `${attribute.name}=${attribute.value}`);
      rows.push({
        reference,
        text,
        badgeTexts,
        sectionLabels: precedingHeadings,
        ancestorClass: owner.getAttribute("class") ?? "",
        dataAttributes,
        isCommercialTable: Boolean(table),
        rowIndex,
      });
    }
    return rows;
  });
}

async function pageStructure(page: Page) {
  return page.evaluate(() => {
    const cleanText = (value: string | null | undefined) => (value ?? "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
    const breadcrumbContainer = document.querySelector(".container.content-ariane, #div_ariane_content .content-ariane, .content-ariane, [class*='breadcrumb']");
    const breadcrumb = breadcrumbContainer
      ? [...breadcrumbContainer.querySelectorAll("a, span")].map((element) => cleanText(element.textContent)).filter(Boolean)
      : [];

    const relatedProducts: Array<{ url: string; label: string; relationType: "RECOMMENDED_PRODUCT" }> = [];
    const headings = [...document.querySelectorAll("h1, h2, h3, h4, strong")];
    for (const heading of headings) {
      if (!/consultez\s+[ée]galement/i.test(cleanText(heading.textContent))) continue;
      const container = heading.closest("section, article, div, table") ?? heading.parentElement;
      if (!container) continue;
      for (const anchor of container.querySelectorAll("a[href]")) {
        const url = (anchor as HTMLAnchorElement).href;
        const label = cleanText(anchor.textContent || anchor.getAttribute("title"));
        if (!url || relatedProducts.some((item) => item.url === url)) continue;
        relatedProducts.push({ url, label, relationType: "RECOMMENDED_PRODUCT" });
      }
    }
    return { breadcrumb, relatedProducts };
  });
}

export async function scanStockmanCatalog(options?: {
  seedUrl?: string;
  maxBrowsePages?: number;
  maxProductPages?: number;
  onProgress?: (progress: StockmanCatalogScanProgress) => void | Promise<void>;
}): Promise<StockmanCatalogScan> {
  const startedAt = new Date();
  const seedUrl = canonicalizeStockmanUrl(options?.seedUrl?.trim() || "https://www.stockman.fr/");
  if (!seedUrl) throw new Error("L’URL de départ Stockman est invalide.");

  const maxBrowsePages = Math.min(Math.max(options?.maxBrowsePages ?? 120, 1), 500);
  const maxProductPages = Math.min(Math.max(options?.maxProductPages ?? 800, 1), 2_000);
  const { browser, context } = await openStockmanBrowser();
  const page = await context.newPage();
  const browseQueue = new FairTaxonomyQueue();
  browseQueue.push({ url: seedUrl, kind: "BROWSE", branch: "root" });
  const queued = new Set([seedUrl]);
  const visited = new Set<string>();
  const productUrls = new Map<string, { label: string | null; sourcePageUrl: string }>();
  const productLinkTraces = new Map<string, StockmanProductLinkTrace>();
  const discardedBrowseUrls = new Set<string>();
  const discardedProductUrls = new Set<string>();
  let productLinksCollected = 0;
  let navigationErrors = 0;
  let canonicalizedUrls = 0;
  let duplicateUrlsAvoided = 0;
  const categoriesDiscovered = new Set<string>();
  const subcategoriesDiscovered = new Set<string>();
  const familyUrlsDiscovered = new Set<string>();
  const warnings: string[] = [];
  const reportProgress = async (progress: StockmanCatalogScanProgress) => {
    await options?.onProgress?.(progress);
  };

  try {
    while (browseQueue.size && visited.size < maxBrowsePages) {
      const node = browseQueue.shift();
      if (!node) break;
      const current = node.url;
      if (visited.has(current)) continue;
      visited.add(current);
      try {
        await gotoStockmanPage(page, current);
        const links = await linksFrom(page);
        for (const link of links) {
          const canonical = canonicalizeStockmanUrl(link.href, page.url());
          if (!canonical) continue;
          if (canonical !== link.href) canonicalizedUrls += 1;
          const navigationKind = classifyStockmanNavigationLink(canonical, link.context);
          const acceptedAsProduct = navigationKind === "FAMILY_PAGE" && looksLikeProductUrl(canonical);
          const acceptedAsBrowse = navigationKind !== null && navigationKind !== "FAMILY_PAGE";
          const legacyReference = legacyReferenceFromProductUrl(canonical);
          const parsed = new URL(canonical);
          const looksProductish = /\.aspx$/i.test(parsed.pathname)
            && (acceptedAsProduct || legacyReference !== null || /(?:produit|palan|chariot|gerbeur|tendeur|pince|cerclage|transpalette|pont|table|cric|verin|vérin)/i.test(parsed.pathname));

          // V2.12.10 diagnostic lecture seule : mémoriser une occurrence par URL
          // candidate afin d'expliquer pourquoi un lien produit a été accepté,
          // basculé en navigation ou rejeté. Aucun changement de classification.
          if (looksProductish && !productLinkTraces.has(canonical)) {
            productLinkTraces.set(canonical, {
              sourcePageUrl: page.url(),
              rawHref: link.rawHref,
              normalizedUrl: canonical,
              canonicalUrl: canonical,
              anchorText: link.text || "",
              pathname: parsed.pathname,
              navigationKind,
              acceptedAsProduct,
              acceptedAsBrowse,
              legacyReference,
              rejectionReason: productLinkRejectionReason(canonical, acceptedAsProduct, legacyReference),
            });
          }

          if (acceptedAsProduct) {
            productLinksCollected += 1;
            familyUrlsDiscovered.add(canonical);
            if (productUrls.has(canonical)) {
              duplicateUrlsAvoided += 1;
            } else if (productUrls.size < maxProductPages) {
              productUrls.set(canonical, { label: link.text || null, sourcePageUrl: current });
            } else {
              discardedProductUrls.add(canonical);
            }
          } else if (acceptedAsBrowse) {
            if (navigationKind === "CATEGORY") categoriesDiscovered.add(canonical);
            if (navigationKind === "SUBCATEGORY") subcategoriesDiscovered.add(canonical);
            if (visited.has(canonical) || queued.has(canonical)) {
              duplicateUrlsAvoided += 1;
            } else if (browseQueue.size < maxBrowsePages * 3) {
              browseQueue.push({
                url: canonical,
                kind: navigationKind ?? "BROWSE",
                branch: stockmanTaxonomyBranch(canonical),
              });
              queued.add(canonical);
            } else {
              discardedBrowseUrls.add(canonical);
            }
          }
        }
      } catch (error) {
        navigationErrors += 1;
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
    const extractedFromBody = 0;
    const noReferenceSamples: string[] = [];
    const failedPageSamples: string[] = [];
    const pageTraces: StockmanProductPageTrace[] = [];

    for (const [productUrl, discoveryContext] of productUrls) {
      if (productPages >= maxProductPages) break;
      productPages += 1;
      productPageAttempts += 1;
      try {
        await gotoStockmanPage(page, productUrl);

        const finalUrl = canonicalizeStockmanUrl(page.url(), productUrl) ?? page.url();
        if (finalUrl !== productUrl) productPageRedirects += 1;

        const bodyText = await page.locator("body").innerText();
        const title = clean(await page.title().catch(() => ""));
        const heading = clean(await page.locator("h1, h2").first().innerText().catch(() => ""));
        const appearsLoggedOut = /(?:se connecter|connexion|identifiez-vous|mot de passe)/i.test(bodyText)
          && !/Déconnexion/i.test(bodyText)
          && !COMMERCIAL_MARKER_RE.test(bodyText);
        if (appearsLoggedOut) {
          throw new Error("Session revendeur inactive : la fiche a redirigé ou affiche l'écran de connexion.");
        }

        productPagesOpened += 1;
        const structure = await pageStructure(page);
        const taxonomy = breadcrumbTaxonomy(structure.breadcrumb);
        const rawCommercialRows = await commercialRows(page);
        const urlReference = referenceFromProductUrl(finalUrl);
        const familyContext: StockmanFamilyContext = {
          sourceUrl: finalUrl,
          category: taxonomy.category,
          subcategory: taxonomy.subcategory,
          familyReference: urlReference,
          familyTitle: heading || title || discoveryContext.label,
          breadcrumb: structure.breadcrumb,
        };
        const rowItems = extractReferencesFromStructuredRows(rawCommercialRows, familyContext);
        extractedFromRows += rowItems.length;

        // V2.10.17.5 : l'intranet est la seule source de vérité.
        // La référence portée par l'URL identifie la famille. Elle n'est ajoutée
        // comme article que si une ligne commerciale la confirme.
        // Plus aucune extraction du body : MINI/MAXI, ENCOMBRANTES, textes de
        // caractéristiques ou menus ne peuvent devenir des références catalogue.
        const pageItems = deduplicatePageReferences(rowItems)
          .filter((item) => !isKnownFalseStockmanReference(item.reference));
        extractedOccurrences += pageItems.length;

        // V2.12.9 diagnostic lecture seule : conserver une trace légère de
        // chaque fiche réellement ouverte afin de distinguer "page non visitée"
        // de "page visitée mais référence non extraite". Aucun contenu n'est
        // utilisé pour créer/importer automatiquement une référence.
        pageTraces.push({
          requestedUrl: productUrl,
          finalUrl,
          discoveryLabel: discoveryContext.label,
          title,
          heading,
          bodySample: clean(bodyText).slice(0, 4_000),
          breadcrumb: structure.breadcrumb,
          category: taxonomy.category,
          subcategory: taxonomy.subcategory,
          familyReference: urlReference,
          familyTitle: familyContext.familyTitle,
          commercialRows: rawCommercialRows.slice(0, 40).map((row) => {
            const classification = classifyCommercialRow(row, familyContext);
            return {
              ...row,
              reference: clean(row.reference),
              text: clean(row.text).slice(0, 1_200),
              relationType: classification.relationType,
              classificationEvidence: classification.evidence,
            };
          }),
          relatedProducts: structure.relatedProducts
            .map((item) => ({ ...item, url: canonicalizeStockmanUrl(item.url, finalUrl) }))
            .filter((item): item is { url: string; label: string; relationType: "RECOMMENDED_PRODUCT" } => Boolean(item.url)),
          extractedReferences: pageItems.map((item) => item.reference),
        });

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

    const browseQueueRemaining = browseQueue.size;
    const browseLimitReached = browseQueueRemaining > 0 && visited.size >= maxBrowsePages;
    const productLimitReached = discardedProductUrls.size > 0 || (productPages >= maxProductPages && productUrls.size > productPages);
    const queueLimitReached = discardedBrowseUrls.size > 0;
    const discardedUrls = discardedBrowseUrls.size + discardedProductUrls.size;
    const unvisitedUrls = new Set([
      ...browseQueue.urls().filter((url) => !visited.has(url)),
      ...discardedBrowseUrls,
      ...discardedProductUrls,
    ]).size;
    const productErrors = productPageFailures;
    const relationCounts = [...discovered.values()].reduce((counts, item) => {
      counts[item.relationType] = (counts[item.relationType] ?? 0) + 1;
      return counts;
    }, {} as Partial<Record<StockmanRelationType, number>>);
    const relatedProducts = pageTraces.reduce((sum, trace) => sum + trace.relatedProducts.length, 0);
    const scanComplete = !browseLimitReached
      && !productLimitReached
      && !queueLimitReached
      && navigationErrors === 0
      && productErrors === 0
      && unvisitedUrls === 0;

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
    if (queueLimitReached) {
      warnings.unshift(
        `Audit exhaustivité : ${discardedUrls} URL(s) de navigation n'ont pas été mises en file car la capacité de la file était atteinte. Le scan n'est pas exhaustif.`,
      );
    }
    if (navigationErrors > 0) {
      warnings.unshift(
        `Audit exhaustivité : ${navigationErrors} page(s) de navigation n'ont pas pu être lues. Le scan n'est pas exhaustif.`,
      );
    }

    return {
      startedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
      pagesVisited: visited.size,
      productPages,
      references: [...discovered.values()].sort((a, b) => a.reference.localeCompare(b.reference, "fr")),
      pageTraces,
      productLinkTraces: [...productLinkTraces.values()],
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
        queueLimitReached,
        discardedUrls,
        unvisitedUrls,
        navigationErrors,
        productErrors,
        canonicalizedUrls,
        duplicateUrlsAvoided,
        categoriesDiscovered: categoriesDiscovered.size,
        subcategoriesDiscovered: subcategoriesDiscovered.size,
        familiesDiscovered: familyUrlsDiscovered.size,
        primaryReferences: (relationCounts.PRIMARY ?? 0) + (relationCounts.PRIMARY_VARIANT ?? 0),
        accessoryReferences: relationCounts.ACCESSORY ?? 0,
        optionReferences: relationCounts.OPTION ?? 0,
        relatedProducts,
        unknownReferences: relationCounts.UNKNOWN ?? 0,
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

export type StockmanDiscoveryBatchNode = {
  id: string;
  url: string;
  nodeType: "BROWSE" | "PRODUCT";
  label?: string | null;
  depth: number;
};

export type StockmanDiscoveryBatchResult = {
  nodeId: string;
  ok: boolean;
  finalUrl: string;
  error?: string;
  children: Array<{
    url: string;
    nodeType: "BROWSE" | "PRODUCT";
    label: string | null;
    depth: number;
    navigationKind: StockmanNavigationKind;
  }>;
  references: StockmanDiscoveredReference[];
  pageTrace?: StockmanProductPageTrace;
  linkTraces: StockmanProductLinkTrace[];
};

/**
 * Processes a bounded set of persisted queue nodes. Unlike scanStockmanCatalog,
 * this function owns no crawl state: callers persist returned children/results
 * before starting another invocation, which makes interruption recoverable.
 */
export async function scanStockmanDiscoveryBatch(
  nodes: StockmanDiscoveryBatchNode[],
): Promise<StockmanDiscoveryBatchResult[]> {
  if (!nodes.length) return [];
  const { browser, context } = await openStockmanBrowser();
  const page = await context.newPage();
  const results: StockmanDiscoveryBatchResult[] = [];

  try {
    for (const node of nodes) {
      const result: StockmanDiscoveryBatchResult = {
        nodeId: node.id,
        ok: false,
        finalUrl: node.url,
        children: [],
        references: [],
        linkTraces: [],
      };
      try {
        await gotoStockmanPage(page, node.url, 12_000, 2);
        const finalUrl = canonicalizeStockmanUrl(page.url(), node.url) ?? page.url();
        result.finalUrl = finalUrl;

        if (node.nodeType === "BROWSE") {
          const links = await linksFrom(page);
          for (const link of links) {
            const canonical = canonicalizeStockmanUrl(link.href, finalUrl);
            if (!canonical) continue;
            const navigationKind = classifyStockmanNavigationLink(canonical, link.context);
            if (!navigationKind) continue;
            const acceptedAsProduct = navigationKind === "FAMILY_PAGE" && looksLikeProductUrl(canonical);
            const acceptedAsBrowse = navigationKind !== "FAMILY_PAGE";
            const legacyReference = legacyReferenceFromProductUrl(canonical);
            const parsed = new URL(canonical);
            const looksProductish = /\.aspx$/i.test(parsed.pathname)
              && (acceptedAsProduct || legacyReference !== null || /(?:produit|palan|chariot|gerbeur|tendeur|pince|cerclage|transpalette|pont|table|cric|verin|vérin)/i.test(parsed.pathname));
            if (looksProductish) {
              result.linkTraces.push({
                sourcePageUrl: finalUrl,
                rawHref: link.rawHref,
                normalizedUrl: canonical,
                canonicalUrl: canonical,
                anchorText: link.text || "",
                pathname: parsed.pathname,
                navigationKind,
                acceptedAsProduct,
                acceptedAsBrowse,
                legacyReference,
                rejectionReason: productLinkRejectionReason(canonical, acceptedAsProduct, legacyReference),
              });
            }
            if (acceptedAsProduct || acceptedAsBrowse) {
              result.children.push({
                url: canonical,
                nodeType: acceptedAsProduct ? "PRODUCT" : "BROWSE",
                label: link.text || null,
                depth: node.depth + 1,
                navigationKind,
              });
            }
          }
        } else {
          const bodyText = await page.locator("body").innerText();
          const title = clean(await page.title().catch(() => ""));
          const heading = clean(await page.locator("h1, h2").first().innerText().catch(() => ""));
          const appearsLoggedOut = /(?:se connecter|connexion|identifiez-vous|mot de passe)/i.test(bodyText)
            && !/Déconnexion/i.test(bodyText)
            && !COMMERCIAL_MARKER_RE.test(bodyText);
          if (appearsLoggedOut) throw new Error("Session revendeur inactive : la fiche affiche l’écran de connexion.");

          const structure = await pageStructure(page);
          const taxonomy = breadcrumbTaxonomy(structure.breadcrumb);
          const rawCommercialRows = await commercialRows(page);
          const familyReference = referenceFromProductUrl(finalUrl);
          const familyContext: StockmanFamilyContext = {
            sourceUrl: finalUrl,
            category: taxonomy.category,
            subcategory: taxonomy.subcategory,
            familyReference,
            familyTitle: heading || title || node.label || null,
            breadcrumb: structure.breadcrumb,
          };
          result.references = deduplicatePageReferences(
            extractReferencesFromStructuredRows(rawCommercialRows, familyContext),
          ).filter((item) => !isKnownFalseStockmanReference(item.reference));
          result.pageTrace = {
            requestedUrl: node.url,
            finalUrl,
            discoveryLabel: node.label ?? null,
            title,
            heading,
            bodySample: clean(bodyText).slice(0, 4_000),
            breadcrumb: structure.breadcrumb,
            category: taxonomy.category,
            subcategory: taxonomy.subcategory,
            familyReference,
            familyTitle: familyContext.familyTitle,
            commercialRows: rawCommercialRows.slice(0, 40).map((row) => {
              const classification = classifyCommercialRow(row, familyContext);
              return {
                ...row,
                reference: clean(row.reference),
                text: clean(row.text).slice(0, 1_200),
                relationType: classification.relationType,
                classificationEvidence: classification.evidence,
              };
            }),
            relatedProducts: structure.relatedProducts
              .map((item) => ({ ...item, url: canonicalizeStockmanUrl(item.url, finalUrl) }))
              .filter((item): item is { url: string; label: string; relationType: "RECOMMENDED_PRODUCT" } => Boolean(item.url)),
            extractedReferences: result.references.map((item) => item.reference),
          };
        }
        result.ok = true;
      } catch (error) {
        result.error = error instanceof Error ? error.message : "Lecture Stockman impossible";
      }
      results.push(result);
    }
    return results;
  } finally {
    await page.close().catch(() => undefined);
    await context.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
  }
}
