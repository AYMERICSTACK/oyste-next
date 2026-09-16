import type { BrowserContext } from "playwright";
import { openStockmanBrowser } from "@/lib/suppliers/stockman/browser";
import { parseStockmanProduct } from "@/lib/suppliers/stockman/parser";
import type { StockmanCommercialFamily, StockmanProduct } from "@/lib/suppliers/stockman/types";

function validateStockmanUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("L'URL de la fiche Stockman est invalide.");
  }

  if (url.protocol !== "https:" || !/(^|\.)stockman\.fr$/i.test(url.hostname)) {
    throw new Error(
      "Utilisez uniquement une URL sécurisée du domaine stockman.fr.",
    );
  }

  return url.toString();
}

function normalizeReference(reference: string) {
  const normalizedReference = reference.trim().toUpperCase();

  if (!/^[A-Z0-9][A-Z0-9./_-]{1,30}$/.test(normalizedReference)) {
    throw new Error("La référence fournisseur est invalide.");
  }

  return normalizedReference;
}


function compactDiagnosticText(value: string, maxLength = 2400) {
  return value
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, maxLength);
}

async function diagnosticWindow(page: import("playwright").Page, bodyText: string, reference: string) {
  const normalized = reference.trim().toUpperCase();
  const lines = bodyText.split(/\r?\n/).map((line) => line.replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ").trim()).filter(Boolean);
  const indexes = lines
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => line.toUpperCase().includes(normalized))
    .map(({ index }) => index);

  const windows = indexes.slice(0, 3).map((index) => {
    const start = Math.max(0, index - 8);
    const end = Math.min(lines.length, index + 28);
    return lines.slice(start, end).join(" | ");
  });

  // V2.8.4 : photographie ciblée de ce que Playwright voit réellement.
  const domProbe = await page.evaluate((ref) => {
    const clean = (value: string | null | undefined) =>
      (value ?? "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();

    const all = Array.from(document.querySelectorAll("*"));
    const exact = all.filter((node) => clean(node.textContent).toUpperCase() === ref);
    const containing = all
      .filter((node) => clean(node.textContent).toUpperCase().includes(ref))
      .slice(0, 12);

    const describeNode = (node: Element) => {
      const row = node.closest("tr");
      const cells = row
        ? Array.from(row.querySelectorAll("td")).map((td, index) => ({
            index,
            id: td.id || "",
            className: typeof td.className === "string" ? td.className : "",
            text: clean(td.textContent).slice(0, 500),
            html: td.outerHTML.slice(0, 900),
          }))
        : [];

      return {
        tag: node.tagName,
        id: node.id || "",
        className: typeof node.className === "string" ? node.className : "",
        text: clean(node.textContent).slice(0, 700),
        rowHtml: row?.outerHTML.slice(0, 6000) ?? "<aucun tr parent>",
        cells,
      };
    };

    const commercial = Array.from(
      document.querySelectorAll(
        "[id*='stock_article'], [id*='price_by_qty'], [id*='stock'], [id*='price']",
      ),
    )
      .slice(0, 80)
      .map((node) => ({
        tag: node.tagName,
        id: node.id || "",
        text: clean(node.textContent).slice(0, 500),
        visible: Boolean((node as HTMLElement).offsetWidth || (node as HTMLElement).offsetHeight),
      }));

    return {
      readyState: document.readyState,
      exactCount: exact.length,
      containingCount: containing.length,
      exact: exact.slice(0, 8).map(describeNode),
      containing: containing.slice(0, 8).map(describeNode),
      commercial,
    };
  }, normalized).catch((error) => ({
    probeError: error instanceof Error ? error.message : String(error),
  }));

  return compactDiagnosticText(
    [
      `URL=${page.url()}`,
      `TITLE=${await page.title().catch(() => "")}`,
      `REF=${normalized}`,
      `READY_STATE=${await page.evaluate(() => document.readyState).catch(() => "?")}`,
      windows.length ? `AROUND_REF=${windows.join("\n---\n")}` : "AROUND_REF=<référence absente du texte>",
      `DOM_PROBE=${JSON.stringify(domProbe, null, 2)}`,
    ].join("\n"),
    14_000,
  );
}

function numberFromCommercialText(value: string) {
  const normalized = value.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
  // Une date de réapprovisionnement (ex. 18/09/2026) n'est jamais un stock.
  if (/date\s+de\s+r[ée]approvisionnement/i.test(normalized)) return null;
  const match = normalized.match(/(\d[\d\s]*(?:[.,]\d{1,2})?)/);
  if (!match?.[1]) return null;
  const parsed = Number(match[1].replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function designationFromRowText(rowText: string, reference: string, pageTitle?: string | null) {
  const lines = rowText
    .split(/\r?\n/)
    .map((line) => line.replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ").trim())
    .filter(Boolean);

  const referenceIndex = lines.findIndex((line) => line.toUpperCase() === reference);
  if (referenceIndex >= 0) {
    const designation = lines.slice(referenceIndex + 1).find((line) =>
      line.length > 6
      && !/^poids\s*:/i.test(line)
      && !/^code[- ]?barres?\s*:/i.test(line)
      && !/^\d+(?:[.,]\d+)?$/.test(line)
      && !/€\s*HT/i.test(line),
    );
    if (designation) return designation;
  }

  if (pageTitle) {
    return pageTitle
      .replace(/\s*[-|]\s*Stockman.*$/i, "")
      .replace(/^Stockman\s*[|:-]\s*/i, "")
      .trim();
  }
  return reference;
}

async function readStructuredCommercialRow(
  page: import("playwright").Page,
  reference: string,
  sourceUrl: string,
  pageTitle?: string | null,
): Promise<StockmanProduct | null> {
  // La référence est affichée dans la ligne commerciale de la variante.
  // On part de son texte exact puis on remonte au <tr>, ce qui évite de
  // dépendre de l'index _0/_1/... utilisé dans les IDs Stockman.
  const exactReferences = page.getByText(reference, { exact: true });
  const count = await exactReferences.count().catch(() => 0);

  for (let index = 0; index < count; index += 1) {
    const row = exactReferences.nth(index).locator("xpath=ancestor::tr[1]");
    if (await row.count().catch(() => 0) === 0) continue;

    const stockCell = row.locator(
      "td[id*='stock_article_td'], td[id*='stock_article'], [id*='stock_article_td']",
    ).first();
    const priceCell = row.locator(
      "td[id*='price_by_qty_td'], td[id*='price_by_qty'], [id*='price_by_qty_td']",
    ).first();

    if (
      await stockCell.count().catch(() => 0) === 0
      || await priceCell.count().catch(() => 0) === 0
    ) {
      continue;
    }

    const [rowText, stockText, priceText] = await Promise.all([
      row.innerText().catch(() => ""),
      stockCell.innerText().catch(() => ""),
      priceCell.innerText().catch(() => ""),
    ]);

    const stockNumber = numberFromCommercialText(stockText);
    const stockOnRequest = /nous\s+consulter|date\s+de\s+r[ée]approvisionnement/i.test(stockText);
    const priceNumber = numberFromCommercialText(priceText);
    if ((!stockOnRequest && stockNumber === null) || priceNumber === null) continue;

    const weightMatch = rowText.match(/Poids\s*:\s*(\d+(?:[.,]\d+)?)\s*kg/i);
    const weightKg = weightMatch
      ? Number(weightMatch[1].replace(",", "."))
      : null;

    return {
      reference,
      designation: designationFromRowText(rowText, reference, pageTitle),
      purchasePriceExVat: priceNumber,
      stock: stockNumber === null ? 0 : Math.trunc(stockNumber),
      stockOnRequest,
      weightKg: weightKg !== null && Number.isFinite(weightKg) ? weightKg : null,
      sourceUrl,
      readAt: new Date().toISOString(),
    };
  }

  // Fallback : certaines pages n'exposent pas la référence comme un nœud texte
  // exact. On parcourt alors uniquement les lignes qui possèdent les cellules
  // commerciales Stockman, puis on vérifie la référence dans le texte de ligne.
  const commercialRows = page.locator(
    "tr:has(td[id*='stock_article_td']):has(td[id*='price_by_qty_td'])",
  );
  const rowCount = await commercialRows.count().catch(() => 0);

  for (let index = 0; index < rowCount; index += 1) {
    const row = commercialRows.nth(index);
    const rowText = await row.innerText().catch(() => "");
    const tokens = rowText
      .split(/\s+/)
      .map((token) => token.replace(/^[^\w.-]+|[^\w./-]+$/g, "").toUpperCase());
    if (!tokens.includes(reference)) continue;

    const [stockText, priceText] = await Promise.all([
      row.locator("td[id*='stock_article_td'], [id*='stock_article_td']").first().innerText().catch(() => ""),
      row.locator("td[id*='price_by_qty_td'], [id*='price_by_qty_td']").first().innerText().catch(() => ""),
    ]);
    const stockNumber = numberFromCommercialText(stockText);
    const stockOnRequest = /nous\s+consulter|date\s+de\s+r[ée]approvisionnement/i.test(stockText);
    const priceNumber = numberFromCommercialText(priceText);
    if ((!stockOnRequest && stockNumber === null) || priceNumber === null) continue;

    const weightMatch = rowText.match(/Poids\s*:\s*(\d+(?:[.,]\d+)?)\s*kg/i);
    const weightKg = weightMatch ? Number(weightMatch[1].replace(",", ".")) : null;

    return {
      reference,
      designation: designationFromRowText(rowText, reference, pageTitle),
      purchasePriceExVat: priceNumber,
      stock: stockNumber === null ? 0 : Math.trunc(stockNumber),
      stockOnRequest,
      weightKg: weightKg !== null && Number.isFinite(weightKg) ? weightKg : null,
      sourceUrl,
      readAt: new Date().toISOString(),
    };
  }

  return null;
}



function commercialReferenceFromRowText(rowText: string) {
  const lines = rowText
    .split(/\r?\n/)
    .map((line) => line.replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ").trim())
    .filter(Boolean);

  const candidates = [
    ...lines.slice(0, 4),
    ...rowText.replace(/\u00a0/g, " ").split(/\s+/).slice(0, 8),
  ];

  for (const raw of candidates) {
    const candidate = raw
      .replace(/^[\s([{"'«]+/, "")
      .replace(/[\s)\]};,"'»,:;]+$/, "")
      .toUpperCase();

    if (
      /^[A-Z0-9][A-Z0-9./_-]{1,30}$/.test(candidate)
      && /[A-Z]/.test(candidate)
      && !/^(?:POIDS|CATALOGUE|STOCK|PRIX|UNITAIRE|QUANTITE|QUANTITÉ|NOUS|CONSULTER|CODE|BARRE|BARRES)$/.test(candidate)
    ) {
      return candidate;
    }
  }

  return null;
}

async function readAllStructuredCommercialRows(
  page: import("playwright").Page,
  sourceUrl: string,
  pageTitle?: string | null,
) {
  await page.waitForFunction(
    () => Boolean(document.querySelector("[id*='stock_article'], [id*='price_by_qty']")),
    undefined,
    { timeout: 8_000 },
  ).catch(() => undefined);

  const commercialRows = page.locator(
    "tr:has(td[id*='stock_article_td']):has(td[id*='price_by_qty_td'])",
  );
  const rowCount = await commercialRows.count().catch(() => 0);
  const products: StockmanProduct[] = [];
  const seen = new Set<string>();

  for (let index = 0; index < rowCount; index += 1) {
    const row = commercialRows.nth(index);
    const [rowText, stockText, priceText] = await Promise.all([
      row.innerText().catch(() => ""),
      row.locator("td[id*='stock_article_td'], [id*='stock_article_td']").first().innerText().catch(() => ""),
      row.locator("td[id*='price_by_qty_td'], [id*='price_by_qty_td']").first().innerText().catch(() => ""),
    ]);

    const reference = commercialReferenceFromRowText(rowText);
    if (!reference || seen.has(reference)) continue;

    const stockNumber = numberFromCommercialText(stockText);
    const stockOnRequest = /nous\s+consulter|date\s+de\s+r[ée]approvisionnement/i.test(stockText);
    const priceOnRequest = /nous\s+consulter/i.test(priceText);
    const priceNumber = numberFromCommercialText(priceText);

    // La présence d'une vraie ligne commerciale suffit à prouver que la variante existe.
    // "Nous consulter" reste une variante valide, mais son PA est conservé à 0/null côté catalogue.
    if ((!stockOnRequest && stockNumber === null) || (!priceOnRequest && priceNumber === null)) {
      continue;
    }

    const weightMatch = rowText.match(/Poids\s*:\s*(\d+(?:[.,]\d+)?)\s*kg/i);
    const weightKg = weightMatch ? Number(weightMatch[1].replace(",", ".")) : null;

    products.push({
      reference,
      designation: designationFromRowText(rowText, reference, pageTitle),
      purchasePriceExVat: priceNumber ?? 0,
      stock: stockNumber === null ? 0 : Math.trunc(stockNumber),
      stockOnRequest,
      weightKg: weightKg !== null && Number.isFinite(weightKg) ? weightKg : null,
      sourceUrl,
      readAt: new Date().toISOString(),
    });
    seen.add(reference);
  }

  return products;
}

function familyReferenceFromPageUrl(value: string, fallback: string) {
  try {
    const path = decodeURIComponent(new URL(value).pathname);
    const match = path.match(/--([A-Z0-9][A-Z0-9./_-]{1,30})\.aspx$/i);
    if (match?.[1]) return match[1].trim().toUpperCase();
  } catch {
    // fallback below
  }
  return fallback.trim().toUpperCase();
}

async function findStockmanDetailUrl(
  page: import("playwright").Page,
  referenceHint: string,
) {
  return page.evaluate((ref) => {
    const normalize = (value: string | null | undefined) =>
      (value ?? "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim().toUpperCase();
    const anchors = Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href]"));

    const exact = anchors.find((anchor) =>
      normalize(anchor.textContent) === ref
      || normalize(anchor.getAttribute("title")) === ref
      || normalize(anchor.querySelector("h1,h2,h3,h4,strong,b")?.textContent) === ref
    );
    if (exact?.href) return exact.href;

    return anchors.find((anchor) => {
      const href = decodeURIComponent(anchor.href).toUpperCase();
      return href.includes(`--${ref}.ASPX`) || href.includes(`-${ref}.ASPX`);
    })?.href ?? null;
  }, referenceHint.trim().toUpperCase()).catch(() => null);
}

async function readStockmanCommercialFamily(
  context: BrowserContext,
  referenceHint: string,
  productUrl: string,
): Promise<StockmanCommercialFamily> {
  const normalizedHint = normalizeReference(referenceHint);
  const sourceUrl = validateStockmanUrl(productUrl.trim());
  const page = await context.newPage();

  try {
    await page.goto(sourceUrl, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await page.waitForTimeout(1_000);

    let bodyText = await page.locator("body").innerText().catch(() => "");
    const loggedOut =
      /connexion|identifiez-vous|mot de passe/i.test(bodyText)
      && !/déconnexion|deconnexion/i.test(bodyText);

    if (loggedOut) {
      throw new Error(
        "La session Stockman a expiré. Régénérez stockman-auth.json puis relancez la reconstruction.",
      );
    }

    let pageTitle = await page.locator("h1").first().textContent().catch(() => null);
    let rows = await readAllStructuredCommercialRows(page, page.url(), pageTitle);

    // Certaines références vivantes pointent encore sur une page catégorie.
    // On suit uniquement un vrai lien produit correspondant à la référence de la fiche.
    if (rows.length === 0) {
      const detailUrl = await findStockmanDetailUrl(page, normalizedHint);
      if (detailUrl && detailUrl !== page.url()) {
        await page.goto(validateStockmanUrl(detailUrl), {
          waitUntil: "domcontentloaded",
          timeout: 45_000,
        });
        await page.waitForTimeout(1_000);
        pageTitle = await page.locator("h1").first().textContent().catch(() => null);
        rows = await readAllStructuredCommercialRows(page, page.url(), pageTitle);
      }
    }

    const pageUrl = page.url();
    const familyReference = familyReferenceFromPageUrl(pageUrl, normalizedHint);
    const familyDesignation =
      (pageTitle ?? "")
        .replace(/\s*[-|]\s*Stockman.*$/i, "")
        .replace(/^Stockman\s*[|:-]\s*/i, "")
        .trim()
      || familyReference;

    if (!rows.length) {
      return {
        sourceUrl,
        pageUrl,
        familyReference,
        familyDesignation,
        products: [],
        kind: "category_or_non_commercial",
      };
    }

    // Les descriptions, images, documents et caractéristiques sont portés par
    // la fiche famille. On enrichit les lignes commerciales depuis cette même page.
    const enriched: StockmanProduct[] = [];
    for (const row of rows) {
      enriched.push(await enrichStockmanProduct(page, row));
    }

    return {
      sourceUrl,
      pageUrl,
      familyReference,
      familyDesignation,
      products: enriched,
      kind: "product_page",
    };
  } finally {
    await page.close().catch(() => undefined);
  }
}


export type StockmanCommercialFamilyDiagnostic = {
  requestedUrl: string;
  finalUrl: string;
  referenceHint: string;
  pageTitle: string;
  loggedOut: boolean;
  followedDetailUrl: string | null;
  familyReference: string;
  commercialCandidateRows: number;
  acceptedCommercialRows: number;
  rows: Array<{
    index: number;
    reference: string | null;
    stockText: string;
    priceText: string;
    stockParsed: number | null;
    priceParsed: number | null;
    stockOnRequest: boolean;
    priceOnRequest: boolean;
    accepted: boolean;
    rejectionReason: string | null;
    rowText: string;
  }>;
  kind: "product_page" | "category_or_non_commercial" | "authentication";
  reason: string;
};

async function inspectCommercialRows(page: import("playwright").Page) {
  await page.waitForTimeout(700);
  const commercialRows = page.locator(
    "tr:has(td[id*='stock_article_td']):has(td[id*='price_by_qty_td'])",
  );
  const count = await commercialRows.count().catch(() => 0);
  const rows: StockmanCommercialFamilyDiagnostic["rows"] = [];

  for (let index = 0; index < count; index += 1) {
    const row = commercialRows.nth(index);
    const [rowText, stockText, priceText] = await Promise.all([
      row.innerText().catch(() => ""),
      row.locator("td[id*='stock_article_td'], [id*='stock_article_td']").first().innerText().catch(() => ""),
      row.locator("td[id*='price_by_qty_td'], [id*='price_by_qty_td']").first().innerText().catch(() => ""),
    ]);

    const reference = commercialReferenceFromRowText(rowText);
    const stockParsed = numberFromCommercialText(stockText);
    const priceParsed = numberFromCommercialText(priceText);
    const stockOnRequest = /nous\s+consulter|date\s+de\s+r[ée]approvisionnement/i.test(stockText);
    const priceOnRequest = /nous\s+consulter/i.test(priceText);

    let rejectionReason: string | null = null;
    if (!reference) rejectionReason = "reference_not_detected_in_commercial_row";
    else if (!stockOnRequest && stockParsed === null) rejectionReason = "stock_not_parseable";
    else if (!priceOnRequest && priceParsed === null) rejectionReason = "price_not_parseable";

    rows.push({
      index,
      reference,
      stockText: stockText.replace(/\s+/g, " ").trim(),
      priceText: priceText.replace(/\s+/g, " ").trim(),
      stockParsed,
      priceParsed,
      stockOnRequest,
      priceOnRequest,
      accepted: rejectionReason === null,
      rejectionReason,
      rowText: rowText.replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ").trim().slice(0, 1800),
    });
  }

  return rows;
}

export async function getStockmanCommercialFamilyDiagnostic(
  referenceHint: string,
  productUrl: string,
): Promise<StockmanCommercialFamilyDiagnostic> {
  const normalizedHint = normalizeReference(referenceHint);
  const requestedUrl = validateStockmanUrl(productUrl.trim());
  const { browser, context } = await openStockmanBrowser();
  const page = await context.newPage();

  try {
    await page.goto(requestedUrl, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await page.waitForTimeout(1_000);

    let bodyText = await page.locator("body").innerText().catch(() => "");
    let pageTitle = (await page.locator("h1").first().textContent().catch(() => null))?.trim() || "";
    const loggedOut =
      /connexion|identifiez-vous|mot de passe/i.test(bodyText)
      && !/déconnexion|deconnexion/i.test(bodyText);

    if (loggedOut) {
      return {
        requestedUrl,
        finalUrl: page.url(),
        referenceHint: normalizedHint,
        pageTitle,
        loggedOut: true,
        followedDetailUrl: null,
        familyReference: familyReferenceFromPageUrl(page.url(), normalizedHint),
        commercialCandidateRows: 0,
        acceptedCommercialRows: 0,
        rows: [],
        kind: "authentication",
        reason: "La page affiche un état de connexion non authentifié.",
      };
    }

    let rows = await inspectCommercialRows(page);
    let followedDetailUrl: string | null = null;

    if (rows.length === 0) {
      const detailUrl = await findStockmanDetailUrl(page, normalizedHint);
      if (detailUrl && detailUrl !== page.url()) {
        followedDetailUrl = validateStockmanUrl(detailUrl);
        await page.goto(followedDetailUrl, { waitUntil: "domcontentloaded", timeout: 45_000 });
        await page.waitForTimeout(1_000);
        bodyText = await page.locator("body").innerText().catch(() => "");
        pageTitle = (await page.locator("h1").first().textContent().catch(() => null))?.trim() || pageTitle;
        rows = await inspectCommercialRows(page);
      }
    }

    const acceptedCommercialRows = rows.filter((row) => row.accepted).length;
    const finalUrl = page.url();
    const familyReference = familyReferenceFromPageUrl(finalUrl, normalizedHint);

    let kind: StockmanCommercialFamilyDiagnostic["kind"] = "product_page";
    let reason = `${acceptedCommercialRows} ligne(s) commerciale(s) exploitable(s).`;

    if (rows.length === 0) {
      kind = "category_or_non_commercial";
      reason = followedDetailUrl
        ? "Lien de détail suivi, mais aucun <tr> contenant simultanément stock_article et price_by_qty n'a été trouvé."
        : "Aucune ligne commerciale structurée et aucun lien de détail correspondant à la référence de départ.";
    } else if (acceptedCommercialRows === 0) {
      kind = "category_or_non_commercial";
      const reasons = Array.from(new Set(rows.map((row) => row.rejectionReason).filter(Boolean)));
      reason = `Des lignes commerciales existent mais aucune n'est exploitable : ${reasons.join(", ") || "raison inconnue"}.`;
    } else if (acceptedCommercialRows < rows.length) {
      const rejected = rows.length - acceptedCommercialRows;
      reason = `${acceptedCommercialRows}/${rows.length} ligne(s) commerciale(s) exploitable(s), ${rejected} rejetée(s).`;
    }

    return {
      requestedUrl,
      finalUrl,
      referenceHint: normalizedHint,
      pageTitle,
      loggedOut: false,
      followedDetailUrl,
      familyReference,
      commercialCandidateRows: rows.length,
      acceptedCommercialRows,
      rows,
      kind,
      reason,
    };
  } finally {
    await page.close().catch(() => undefined);
    await context.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
  }
}

export async function getStockmanCommercialFamily(
  referenceHint: string,
  productUrl: string,
): Promise<StockmanCommercialFamily> {
  const { browser, context } = await openStockmanBrowser();
  try {
    return await readStockmanCommercialFamily(context, referenceHint, productUrl);
  } finally {
    await context.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
  }
}

type StockmanNetworkAuditEntry = {
  type: string;
  status: number;
  url: string;
};

async function isStockmanLoginPage(page: import("playwright").Page) {
  return page.evaluate(() => {
    const clean = (value: string | null | undefined) =>
      (value ?? "").replace(/\s+/g, " ").trim();
    const body = clean(document.body?.innerText);
    const url = window.location.href;
    const hasPasswordInput = Boolean(document.querySelector("input[type='password']"));
    const hasLoginForm = Boolean(document.querySelector("form[action*='login' i], form[action*='connexion' i]"));
    const connectedMarker = /déconnexion|deconnexion|sign out|logout|bonjour\s+[A-ZÀ-Ÿ]|hello\s+[A-Z]/i.test(body);
    const loginUrl = /\b(?:login|connexion|connect)\b/i.test(url);

    // V2.12.8.3 — le simple mot « connexion » dans le contenu/footer ne
    // signifie pas que la session a expiré. On ne considère la page comme
    // déconnectée que si le DOM ressemble réellement à un écran de login
    // (champ mot de passe / formulaire / URL dédiée) ET qu'aucun marqueur
    // de compte connecté n'est visible.
    return !connectedMarker && (hasPasswordInput || hasLoginForm || loginUrl);
  }).catch(() => false);
}

async function buildSessionAudit(
  context: BrowserContext,
  page: import("playwright").Page,
  network: StockmanNetworkAuditEntry[],
) {
  const cookies = await context.cookies(["https://www.stockman.fr/"]).catch(() => []);
  const storage = await page.evaluate(() => ({
    localStorageKeys: Object.keys(window.localStorage),
    sessionStorageKeys: Object.keys(window.sessionStorage),
    hasPasswordInput: Boolean(document.querySelector("input[type='password']")),
    hasLoginForm: Boolean(document.querySelector("form[action*='login' i], form[action*='connexion' i]")),
    accountMarkers: Array.from(document.querySelectorAll("a, button"))
      .map((node) => (node.textContent ?? "").replace(/\s+/g, " ").trim())
      .filter((text) => /mon compte|déconnexion|deconnexion|logout|connexion|identifiez/i.test(text))
      .slice(0, 20),
  })).catch(() => ({
    localStorageKeys: [] as string[],
    sessionStorageKeys: [] as string[],
    hasPasswordInput: false,
    hasLoginForm: false,
    accountMarkers: [] as string[],
  }));

  return {
    cookieCount: cookies.length,
    cookies: cookies.map((cookie) => ({
      name: cookie.name,
      domain: cookie.domain,
      path: cookie.path,
      expires: cookie.expires,
      httpOnly: cookie.httpOnly,
      secure: cookie.secure,
      sameSite: cookie.sameSite,
    })),
    ...storage,
    network: network.slice(-80),
  };
}



async function enrichmentDomDiagnostic(
  page: import("playwright").Page,
  reference: string,
) {
  const payload = await page.evaluate((ref) => {
    const clean = (value: string | null | undefined) =>
      (value ?? "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
    const abs = (value: string | null | undefined) => {
      if (!value) return null;
      try { return new URL(value, window.location.href).toString(); } catch { return null; }
    };

    const all = Array.from(document.querySelectorAll("body *"));
    const refNode = all.find((node) => clean(node.textContent).toUpperCase() === ref.toUpperCase()) ?? null;

    const imageNodes = Array.from(document.querySelectorAll<HTMLImageElement>("img")).map((img) => ({
      id: img.id || "",
      className: typeof img.className === "string" ? img.className : "",
      alt: clean(img.alt),
      src: img.getAttribute("src"),
      currentSrc: img.currentSrc || "",
      srcset: img.getAttribute("srcset"),
      dataSrc: img.getAttribute("data-src"),
      dataOriginal: img.getAttribute("data-original"),
      dataLazy: img.getAttribute("data-lazy"),
      dataZoomImage: img.getAttribute("data-zoom-image"),
      width: img.naturalWidth || img.width || 0,
      height: img.naturalHeight || img.height || 0,
      parentHtml: img.parentElement?.outerHTML.slice(0, 2500) ?? "",
    }));

    const imageLinks = Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href]"))
      .filter((a) => /\.(?:jpe?g|png|webp)(?:$|[?#])/i.test(a.href))
      .map((a) => ({
        href: abs(a.getAttribute("href")),
        title: clean(a.title),
        text: clean(a.textContent),
        html: a.outerHTML.slice(0, 2000),
      }));

    const backgroundNodes = Array.from(document.querySelectorAll<HTMLElement>("[style*='background'], [data-background], [data-bg]"))
      .map((el) => ({
        tag: el.tagName,
        id: el.id || "",
        className: typeof el.className === "string" ? el.className : "",
        style: el.getAttribute("style"),
        dataBackground: el.getAttribute("data-background"),
        dataBg: el.getAttribute("data-bg"),
        text: clean(el.textContent).slice(0, 500),
      }))
      .slice(0, 40);

    const headings = Array.from(document.querySelectorAll("h1,h2,h3,h4,h5,strong,b"))
      .map((node) => ({
        tag: node.tagName,
        id: node.id || "",
        className: typeof node.className === "string" ? node.className : "",
        text: clean(node.textContent),
        parentHtml: node.parentElement?.outerHTML.slice(0, 5000) ?? "",
      }))
      .filter((item) =>
        /description|caract[eé]ristiques techniques|documentation/i.test(item.text)
        || item.text.toUpperCase().includes(ref.toUpperCase())
      )
      .slice(0, 40);

    const descriptionCandidates = all
      .filter((node) => {
        const text = clean(node.textContent);
        return text.length >= 80
          && text.length <= 2200
          && !/cookie|newsletter|confidentialit[eé]/i.test(text);
      })
      .slice(0, 80)
      .map((node) => ({
        tag: node.tagName,
        id: node.id || "",
        className: typeof node.className === "string" ? node.className : "",
        text: clean(node.textContent).slice(0, 1800),
        html: node.outerHTML.slice(0, 3500),
      }));

    return {
      url: window.location.href,
      title: document.title,
      readyState: document.readyState,
      reference: ref,
      referenceNode: refNode ? {
        tag: refNode.tagName,
        id: refNode.id || "",
        className: typeof refNode.className === "string" ? refNode.className : "",
        text: clean(refNode.textContent),
        parentHtml: refNode.parentElement?.outerHTML.slice(0, 5000) ?? "",
      } : null,
      imageCount: imageNodes.length,
      images: imageNodes.slice(0, 80),
      imageLinks: imageLinks.slice(0, 60),
      backgroundNodes,
      headings,
      descriptionCandidates,
    };
  }, reference).catch((error) => ({
    diagnosticError: error instanceof Error ? error.message : String(error),
  }));

  return JSON.stringify(payload, null, 2).slice(0, 30000);
}

async function enrichStockmanProduct(
  page: import("playwright").Page,
  product: StockmanProduct,
): Promise<StockmanProduct> {
  // RC4.2 V2.9.8 : l'enrichissement est lu dans le DOM réellement rendu par la
  // session revendeur. On ne dépend plus d'une structure de balises précise :
  // Stockman mélange h*, div, td et strong suivant les familles de produits.
  const enrichment = await page.evaluate((input) => {
    const reference = input.reference;
    const designation = input.designation;
    const targetWeightKg = input.weightKg;
    const clean = (value: string | null | undefined) =>
      (value ?? "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
    const absolute = (value: string | null | undefined) => {
      if (!value) return null;
      try { return new URL(value, window.location.href).toString(); } catch { return null; }
    };
    const isVisible = (node: Element) => {
      const el = node as HTMLElement;
      const style = window.getComputedStyle(el);
      return style.display !== "none" && style.visibility !== "hidden";
    };
    const all = Array.from(document.querySelectorAll("body *"));
    const exactTextNode = (pattern: RegExp) => all.find((node) => {
      const text = clean(node.textContent);
      return text.length <= 80 && pattern.test(text) && isVisible(node);
    });

    const refUpper = reference.toUpperCase();
    const referenceNode = all.find((node) => clean(node.textContent).toUpperCase() === refUpper && isVisible(node));

    // Résumé : on cherche d'abord le bloc de présentation près du titre/référence,
    // puis on retombe sur les paragraphes visibles précédant le tableau commercial.
    let shortDescription: string | null = null;
    const titleNode = Array.from(document.querySelectorAll("h1,h2,h3,h4,.h1,.h2,.h3,.h4"))
      .find((node) => clean(node.textContent).toUpperCase() === refUpper || clean(node.textContent).toUpperCase().includes(refUpper));
    const presentationRoot = titleNode?.parentElement ?? referenceNode?.parentElement ?? null;
    if (presentationRoot) {
      const candidates = Array.from(presentationRoot.querySelectorAll("p,div,span"))
        .map((node) => clean(node.textContent))
        .filter((text) => text.length >= 45 && text.length <= 900)
        .filter((text) => !text.toUpperCase().startsWith(refUpper))
        .filter((text) => !/^(stock|prix unitaire|quantit[eé]|documentation)/i.test(text));
      shortDescription = candidates.sort((a, b) => a.length - b.length)[0] ?? null;
    }
    if (!shortDescription) {
      const candidates = Array.from(document.querySelectorAll("p"))
        .filter(isVisible)
        .map((node) => clean(node.textContent))
        .filter((text) => text.length >= 60 && text.length <= 900)
        .filter((text) => !/cookie|confidentialit[eé]|newsletter/i.test(text));
      shortDescription = candidates[0] ?? null;
    }

    // V2.9.8 : Stockman expose désormais un conteneur natif fiable pour le
    // contenu éditorial. On le lit AVANT toute heuristique afin de ne jamais
    // confondre le tableau des variantes avec la description de la famille.
    const descriptionHeading = exactTextNode(/^description$/i);
    const technicalHeading = exactTextNode(/^caract[eé]ristiques techniques$/i);
    let detailedDescription: string | null = null;

    const nativeDescriptionRoot = (() => {
      const marker = document.querySelector<HTMLElement>("#Content_desc_long");
      if (marker?.parentElement) return marker.parentElement;
      return document.querySelector<HTMLElement>("#descriptionContent");
    })();

    if (nativeDescriptionRoot) {
      const clone = nativeDescriptionRoot.cloneNode(true) as HTMLElement;

      // Nettoyage défensif : aucun contrôle, script, panneau technique ou élément
      // caché ne doit finir dans le texte éditorial OYSTE.
      clone.querySelectorAll(
        "script,style,noscript,input,button,select,textarea,[hidden],.hidden,.d-none,#Content_caract,#Content_caract_title,[id*='caract_'],[class*='technical' i]",
      ).forEach((node) => node.remove());

      // V2.9.9.4 : conserver la structure éditoriale Stockman dans le champ texte
      // OYSTE avec une syntaxe légère compatible avec l'éditeur : ## titres,
      // • listes, **gras** et [libellé](url) pour les liens.
      const inlineText = (node: Node): string => {
        if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
        if (!(node instanceof HTMLElement)) return "";
        const tag = node.tagName.toLowerCase();

        // Important : Stockman structure une grande partie de la description avec
        // <br><br> dans un seul <li>. Il faut conserver ces séparateurs AVANT de
        // normaliser les espaces, sinon toute la fiche finit sur une seule ligne.
        if (tag === "br") return "\n";

        const children = Array.from(node.childNodes).map(inlineText).join("");
        const value = children
          .replace(/\u00a0/g, " ")
          .replace(/[ \t]+/g, " ")
          .replace(/ *\n */g, "\n")
          .trim();
        if (!value) return "";
        if (tag === "a") {
          const href = absolute(node.getAttribute("href"));
          return href ? `[${value}](${href})` : value;
        }
        if (tag === "strong" || tag === "b") return `**${value}**`;
        if (tag === "em" || tag === "i") return `*${value}*`;
        return value;
      };

      const blocks: string[] = [];
      const pushBlock = (value: string) => {
        const normalized = value.replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ").trim();
        if (!normalized || /^(description|caract[eé]ristiques techniques)$/i.test(normalized)) return;
        if (blocks[blocks.length - 1] !== normalized) blocks.push(normalized);
      };

      const walkEditorial = (root: HTMLElement) => {
        for (const child of Array.from(root.children)) {
          const element = child as HTMLElement;
          const tag = element.tagName.toLowerCase();
          if (/^h[1-6]$/.test(tag)) {
            pushBlock(`## ${inlineText(element).replace(/^\*\*|\*\*$/g, "")}`);
            continue;
          }
          if (tag === "p") {
            const onlyStrong = element.children.length === 1 && /^(strong|b)$/i.test(element.children[0].tagName);
            const value = inlineText(element);
            pushBlock(onlyStrong ? `**${value.replace(/^\*\*|\*\*$/g, "")}**` : value);
            continue;
          }
          if (tag === "strong" || tag === "b") {
            const value = inlineText(element).replace(/^\*\*|\*\*$/g, "");
            pushBlock(`**${value}**`);
            continue;
          }
          if (tag === "br") {
            continue;
          }
          if (tag === "ul" || tag === "ol") {
            Array.from(element.children).forEach((li) => {
              if (li.tagName.toLowerCase() === "li") pushBlock(`• ${inlineText(li)}`);
            });
            continue;
          }
          if (tag === "li") {
            const directParagraphs = Array.from(element.children).filter((item) => item.tagName.toLowerCase() === "p") as HTMLElement[];
            if (directParagraphs.length) {
              directParagraphs.forEach((paragraph) => {
                const onlyStrong = paragraph.children.length === 1 && /^(strong|b)$/i.test(paragraph.children[0].tagName);
                const value = inlineText(paragraph);
                pushBlock(onlyStrong ? `**${value.replace(/^\*\*|\*\*$/g, "")}**` : value);
              });
              Array.from(element.children)
                .filter((item) => !["p", "ul", "ol"].includes(item.tagName.toLowerCase()))
                .forEach((item) => walkEditorial(item as HTMLElement));
              Array.from(element.children)
                .filter((item) => ["ul", "ol"].includes(item.tagName.toLowerCase()))
                .forEach((item) => walkEditorial(item as HTMLElement));
            } else {
              // Les descriptions Stockman sont souvent un unique <li> contenant
              // titres <b>, paragraphes et doubles <br>. On le découpe en vrais
              // blocs éditoriaux plutôt que de préfixer toute la fiche par une puce.
              const raw = inlineText(element)
                .replace(/\n{3,}/g, "\n\n")
                .trim();
              const chunks = raw
                .split(/\n\s*\n/)
                .map((chunk) => chunk.replace(/\n+/g, " ").replace(/[ \t]+/g, " ").trim())
                .filter(Boolean);
              if (chunks.length > 1) {
                chunks.forEach(pushBlock);
              } else {
                const compact = raw.replace(/\n+/g, " ").trim();
                // Stockman encapsule parfois toute la description dans un <li>.
                // Si ce bloc est en réalité un titre éditorial en gras, ne pas
                // fabriquer de puce devant lui.
                pushBlock(/^\*\*[^*]+\*\*$/.test(compact) ? compact : `• ${compact}`);
              }
            }
            continue;
          }
          walkEditorial(element);
        }
      };

      walkEditorial(clone);
      const structuredText = blocks.join("\n\n").replace(/\n{3,}/g, "\n\n").trim();
      const nativeText = structuredText.length >= 220
        ? structuredText
        : (clone.innerText || clone.textContent || "")
            .replace(/\u00a0/g, " ")
            .replace(/\r/g, "")
            .split("\n")
            .map((line) => line.replace(/[ \t]+/g, " ").trim())
            .filter((line) => line && !/^(description|caract[eé]ristiques techniques)$/i.test(line))
            .join("\n\n")
            .replace(/\n{3,}/g, "\n\n")
            .trim();

      const variantLines = nativeText
        .split(/\n/)
        .filter((line) =>
          /\b(?:lev[eé]e|hauteur|m[aâ]t)\b.*\b\d{3,5}\s*mm\b/i.test(line)
          && /\bbatterie\b.*\b\d{2,4}\s*ah\b/i.test(line),
        ).length;

      // Sécurité : un bloc natif valide doit être substantiel et ne pas être
      // majoritairement une liste de déclinaisons commerciales.
      if (nativeText.length >= 220 && variantLines < 3) {
        detailedDescription = nativeText.slice(0, 24_000);
      }
    }

    // Fallback historique pour les anciennes familles Stockman qui n'exposent pas
    // encore #Content_desc_long / #descriptionContent.
    if (!detailedDescription && descriptionHeading) {
      const descIndex = all.indexOf(descriptionHeading);
      const techIndex = technicalHeading ? all.indexOf(technicalHeading) : Math.min(all.length, descIndex + 250);
      const chunks: string[] = [];
      for (let i = descIndex + 1; i < techIndex && i < descIndex + 250; i += 1) {
        const node = all[i];
        if (!isVisible(node) || node.children.length > 3) continue;
        const text = clean(node.textContent);
        if (text.length < 35 || text.length > 1800) continue;
        if (/^(description|caract[eé]ristiques techniques|documentation)$/i.test(text)) continue;
        if (!chunks.some((existing) => existing === text || existing.includes(text) || text.includes(existing))) chunks.push(text);
      }
      if (chunks.length) detailedDescription = chunks.slice(0, 12).join("\n\n");
    }

    // V2.9.6.1 : le contenu éditorial long de Stockman est beaucoup plus fiable
    // dans innerText que dans la hiérarchie DOM. Sur certaines familles, le libellé
    // "Caractéristiques techniques" se trouve immédiatement après "DESCRIPTION",
    // puis vient tout le texte éditorial : on ne doit donc surtout pas l'utiliser
    // comme borne de fin.
    if (!detailedDescription) {
      const bodyLines = (document.body?.innerText ?? "")
        .replace(/\u00a0/g, " ")
        .split(/\r?\n/)
        .map((line) => line.replace(/[ \t]+/g, " ").trim())
        .filter(Boolean);

      const descriptionIndex = bodyLines.findIndex((line) => /^description$/i.test(line));
      if (descriptionIndex >= 0) {
        let endIndex = bodyLines.findIndex(
          (line, index) => index > descriptionIndex && /^documentation$/i.test(line),
        );
        if (endIndex < 0) endIndex = Math.min(bodyLines.length, descriptionIndex + 260);

        const rawEditorial = bodyLines.slice(descriptionIndex + 1, endIndex);
        const looksLikeVariantLine = (line: string) => {
          const normalized = line.toLowerCase();
          const hasDimensions = /\b(?:lev[eé]e|hauteur|m[aâ]t)\b.*\b\d{3,5}\s*mm\b/i.test(line);
          const hasBattery = /\bbatterie\b.*\b\d{2,4}\s*ah\b/i.test(line);
          const hasVariantRef = new RegExp(`^${refUpper.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/(?:100|150|200)$/i, "")}[-A-Z0-9]*`, "i").test(line);
          const commercial = /^(stock|prix unitaire ht|quantit[eé]|poids\s*:|code barre\s*:)/i.test(line);
          return commercial || hasVariantRef || (hasDimensions && hasBattery) || /produit arr[eê]t[eé]/i.test(normalized);
        };

        const editorial = rawEditorial
          .filter((line) => !/^caract[eé]ristiques techniques$/i.test(line))
          .filter((line) => !/^image\s*:\s*(imprimer|t[eé]l[eé]charger)/i.test(line))
          .filter((line) => !/^en savoir plus$/i.test(line))
          .filter((line) => !looksLikeVariantLine(line));

        const compact: string[] = [];
        for (const line of editorial) {
          if (!line || compact[compact.length - 1] === line) continue;
          if (compact.some((existing) => existing === line || existing.includes(line) || line.includes(existing))) continue;
          compact.push(line);
        }

        // Une vraie description doit contenir du texte éditorial, pas uniquement
        // quelques lignes de caractéristiques ou de variantes.
        const prose = compact.filter((line) => line.length >= 45 && /[.!?:;]/.test(line));
        const candidate = (prose.length >= 2 ? prose : compact.filter((line) => line.length >= 70)).join("\n\n").trim();
        if (candidate.length >= 220) {
          detailedDescription = candidate.slice(0, 16_000);
        }
      }
    }

    // Certaines fiches n'affichent pas littéralement le titre DESCRIPTION.
    // Dans ce cas on récupère les paragraphes du bloc de présentation du produit.
    if (!detailedDescription) {
      const roots = [
        titleNode?.parentElement,
        titleNode?.parentElement?.parentElement,
        referenceNode?.closest("div"),
      ].filter(Boolean) as Element[];
      const chunks: string[] = [];
      for (const root of roots) {
        for (const node of Array.from(root.querySelectorAll("p,div,span"))) {
          const value = clean(node.textContent);
          if (value.length < 80 || value.length > 1800) continue;
          if (/prix|stock|quantit[eé]|code barre|poids\s*:/i.test(value)) continue;
          if (!chunks.some((existing) => existing === value || existing.includes(value) || value.includes(existing))) chunks.push(value);
        }
      }
      if (chunks.length) detailedDescription = chunks.slice(0, 8).join("\n\n");
    }

    // Images V2.9.3 : Stockman utilise plusieurs galeries suivant les familles.
    // On agrège img/src, lazy-load, srcset, liens vers l'original et background-image.
    const imageCandidates: Array<{ url: string; altText: string | null; score: number }> = [];
    const addImage = (raw: string | null | undefined, altText: string | null, score = 0) => {
      const url = absolute(raw);
      if (!url) return;
      const fingerprint = `${url} ${altText ?? ""}`.toLowerCase();
      if (/logo|banner|banniere|picto|icon|flag|catalogue|actualite|video|devis|facebook|linkedin|youtube|sprite/.test(fingerprint)) return;
      if (!/stockman\.fr/i.test(url)) return;
      imageCandidates.push({ url, altText, score });
    };

    Array.from(document.querySelectorAll<HTMLImageElement>("img")).forEach((img) => {
      const alt = clean(img.alt) || null;
      const attrs = [
        img.currentSrc,
        img.getAttribute("src"),
        img.getAttribute("data-src"),
        img.getAttribute("data-original"),
        img.getAttribute("data-lazy"),
        img.getAttribute("data-zoom-image"),
      ];
      attrs.forEach((raw) => addImage(raw, alt, /product|article|upload\/products?_data/i.test(raw ?? "") ? 40 : 0));
      const srcset = img.getAttribute("srcset") || img.getAttribute("data-srcset");
      if (srcset) srcset.split(",").forEach((part) => addImage(part.trim().split(/\s+/)[0], alt, 30));
      const area = Math.max(img.naturalWidth || img.width || 0, 0) * Math.max(img.naturalHeight || img.height || 0, 0);
      if (area >= 20_000) attrs.forEach((raw) => addImage(raw, alt, 25));
    });

    Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href]")).forEach((a) => {
      const href = a.getAttribute("href");
      if (href && /\.(?:jpe?g|png|webp)(?:\?|$)/i.test(href)) addImage(href, clean(a.getAttribute("title")) || null, 35);
    });

    Array.from(document.querySelectorAll<HTMLElement>("[style*='background'], [data-background], [data-bg]")).forEach((el) => {
      const bg = el.style.backgroundImage.match(/url\(["']?([^"')]+)["']?\)/i)?.[1];
      addImage(bg || el.getAttribute("data-background") || el.getAttribute("data-bg"), clean(el.getAttribute("title")) || null, 15);
    });

    const seenImages = new Set<string>();
    const images = imageCandidates
      .sort((a, b) => b.score - a.score)
      .filter((img) => !seenImages.has(img.url) && seenImages.add(img.url))
      .slice(0, 12)
      .map(({ url, altText }) => ({ url, altText }));

    const seenDocs = new Set<string>();
    const documents = Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href]"))
      .map((anchor) => ({ url: absolute(anchor.href), name: clean(anchor.textContent) || clean(anchor.title) }))
      .filter((doc) => doc.url && (/\.pdf(?:$|[?#])/i.test(doc.url) || /upload\/products_data\/files/i.test(doc.url)))
      .filter((doc) => !seenDocs.has(doc.url!) && seenDocs.add(doc.url!))
      .slice(0, 16)
      .map((doc) => {
        const label = doc.name || "Document Stockman";
        const lower = label.toLowerCase();
        const type = /fiche technique|technical/.test(lower) ? ("TECHNICAL_SHEET" as const)
          : /manuel|notice|utilisation|installation/.test(lower) ? ("INSTALLATION_MANUAL" as const)
          : /plan|encombrement|dimension/.test(lower) ? ("DIMENSION_DRAWING" as const)
          : /certificat|conformit/.test(lower) ? ("CERTIFICATE" as const)
          : /commercial|brochure|catalogue/.test(lower) ? ("COMMERCIAL_DOCUMENT" as const) : ("OTHER" as const);
        return { name: label, url: doc.url!, type };
      });

    // V2.10.2.1 : caractéristiques techniques de la référence synchronisée.
    // Stockman peut présenter une famille complète dans un tableau à plusieurs
    // colonnes. On privilégie donc explicitement la colonne de la référence cible
    // au lieu de prendre naïvement les deux premières cellules de chaque ligne.
    const featurePairs: Array<{ label: string; value: string }> = [];
    const featureLabelKey = (value: string) => clean(value).toLowerCase().replace(/\s+/g, " ").replace(/\s*:\s*$/, "");
    const normalizeRef = (value: string) => clean(value).toUpperCase().replace(/[^A-Z0-9]/g, "");
    const targetRef = normalizeRef(refUpper);
    const addFeature = (labelRaw: string, valueRaw: string) => {
      const label = clean(labelRaw).replace(/\s*:\s*$/, "");
      const value = clean(valueRaw);
      if (!label || !value || label.length > 140 || value.length > 700 || label === value) return;
      if (/^(stock|prix|prix unitaire ht|quantit[eé]|d[eé]signation|r[eé]f[eé]rence|code barre|documentation)$/i.test(label)) return;
      if (/^(description|caract[eé]ristiques techniques|ajouter [àa] mon devis)$/i.test(value)) return;
      const key = featureLabelKey(label);
      const existing = featurePairs.findIndex((item) => featureLabelKey(item.label) === key);
      if (existing >= 0) {
        // Une valeur extraite de la colonne exacte de la référence est ajoutée en
        // premier. Les fallbacks ne doivent jamais l'écraser.
        return;
      }
      featurePairs.push({ label, value });
    };

    const technicalRoots = [
      document.querySelector<HTMLElement>("#Content_caract"),
      document.querySelector<HTMLElement>("#Content_caracteristiques"),
      document.querySelector<HTMLElement>("#caracteristiquesContent"),
      technicalHeading?.closest<HTMLElement>("[id*='caract' i], [class*='caract' i], .row"),
      technicalHeading?.parentElement?.parentElement,
    ].filter((root, index, roots): root is HTMLElement => Boolean(root) && roots.indexOf(root) === index);

    const tableCandidates = technicalRoots.flatMap((root) => Array.from(root.querySelectorAll<HTMLTableElement>("table")));
    const tables = tableCandidates.length
      ? Array.from(new Set(tableCandidates))
      : Array.from(document.querySelectorAll<HTMLTableElement>("table")).filter((table) => {
          const text = clean(table.textContent);
          return text.length > 20 && (normalizeRef(text).includes(targetRef) || /lev[eé]e|batterie|fourche|m[aâ]t|empattement|roue/i.test(text));
        });

    // 1) Tableau multi-variantes : recherche de la colonne PS12L40-ION150.
    for (const table of tables) {
      const rows = Array.from(table.querySelectorAll<HTMLTableRowElement>("tr"));
      if (!rows.length) continue;
      let targetColumn = -1;
      for (const row of rows) {
        const cells = Array.from(row.querySelectorAll<HTMLElement>(":scope > th, :scope > td"));
        const index = cells.findIndex((cell) => normalizeRef(cell.textContent || "") === targetRef);
        if (index >= 0) {
          targetColumn = index;
          break;
        }
      }
      if (targetColumn < 0) continue;

      for (const row of rows) {
        const cells = Array.from(row.querySelectorAll<HTMLElement>(":scope > th, :scope > td")).map((cell) => clean(cell.textContent));
        if (cells.length <= targetColumn) continue;
        const value = cells[targetColumn];
        if (!value || normalizeRef(value) === targetRef) continue;

        // Stockman utilise suivant les familles soit [libellé, unité, variantes…],
        // soit simplement [libellé, variantes…]. L'unité est rattachée à la valeur.
        const label = cells[0];
        const unit = targetColumn >= 2 && cells[1] && cells[1].length <= 18 && !/^[\d.,]+$/.test(cells[1]) ? cells[1] : "";
        const withUnit = unit && !value.toLowerCase().includes(unit.toLowerCase()) ? `${value} ${unit}` : value;
        addFeature(label, withUnit);
      }
    }

    // 2) Tableau de la référence seule : classique libellé / valeur.
    if (!featurePairs.length) {
      for (const table of tables) {
        Array.from(table.querySelectorAll<HTMLTableRowElement>("tr")).forEach((row) => {
          const cells = Array.from(row.querySelectorAll<HTMLElement>(":scope > th, :scope > td"))
            .map((cell) => clean(cell.textContent))
            .filter(Boolean);
          if (cells.length === 2) addFeature(cells[0], cells[1]);
          if (cells.length === 3 && cells[1].length <= 18) {
            const value = cells[2].toLowerCase().includes(cells[1].toLowerCase()) ? cells[2] : `${cells[2]} ${cells[1]}`;
            addFeature(cells[0], value);
          }
        });
      }
    }

    // 3) <dl><dt>Libellé</dt><dd>Valeur</dd> utilisé sur certaines pages.
    if (!featurePairs.length) {
      for (const root of technicalRoots) {
        Array.from(root.querySelectorAll<HTMLElement>("dt")).forEach((dt) => {
          const dd = dt.nextElementSibling;
          if (dd?.tagName.toLowerCase() === "dd") addFeature(dt.textContent || "", dd.textContent || "");
        });
      }
    }

    // 4) Dernier fallback : lignes "Libellé : valeur" strictement bornées à la
    // zone technique. On ne parcourt plus document.body, ce qui évite d'importer
    // description, prix ou variantes commerciales comme caractéristiques.
    if (!featurePairs.length && technicalHeading) {
      const techIndex = all.indexOf(technicalHeading);
      for (let i = techIndex + 1; i < Math.min(all.length, techIndex + 180); i += 1) {
        const node = all[i];
        const text = clean(node.textContent);
        if (/^(documentation|description)$/i.test(text)) break;
        if (node.children.length > 2 || text.length > 500) continue;
        const match = text.match(/^([^:]{2,120})\s*:\s*(.+)$/);
        if (match) addFeature(match[1], match[2]);
      }
    }


    // V2.10.2.1 : quand Stockman n'expose pas un tableau technique réellement
    // décliné par référence, la zone "Informations techniques" décrit la famille et
    // contient des plages "selon modèles". On ne doit jamais publier ces plages
    // comme si elles étaient propres à PS12L40-ION150. Les données explicites de la
    // désignation commerciale de la référence et son poids lu dans la ligne produit
    // sont alors prioritaires.
    const exactFeaturePairs = featurePairs.map((feature) => ({ ...feature }));
    const exactKey = (label: string) => featureLabelKey(label)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

    const removeFeature = (pattern: RegExp) => {
      for (let index = exactFeaturePairs.length - 1; index >= 0; index -= 1) {
        if (pattern.test(exactKey(exactFeaturePairs[index].label))) exactFeaturePairs.splice(index, 1);
      }
    };

    const setExactFeature = (label: string, value: string, replacePattern: RegExp) => {
      removeFeature(replacePattern);
      exactFeaturePairs.push({ label, value });
    };

    const designationText = clean(designation);
    const batteryMatches = [...designationText.matchAll(/(\d{2,4})\s*Ah\b/gi)];
    const batteryAh = batteryMatches.length
      ? batteryMatches[batteryMatches.length - 1][1]
      : null;
    const liftMatches = [...designationText.matchAll(/(?:lev[eé]e|hauteur(?:\s+de)?\s+lev[eé]e)[^0-9]{0,40}(\d{3,5})\s*mm\b/gi)];
    const liftMm = liftMatches.length
      ? liftMatches[liftMatches.length - 1][1]
      : null;
    const mast = /\btriplex\b/i.test(designationText)
      ? "Triplex grande levée libre"
      : /\bduplex\b/i.test(designationText)
        ? "Duplex grande levée libre"
        : null;

    if (batteryAh) {
      setExactFeature("Batterie lithium", `${batteryAh} Ah`, /^batterie(?: lithium)?$/i);
    }

    if (mast) {
      setExactFeature("Mât", mast, /^mats?(?: disponibles)?$/i);
    }

    if (liftMm) {
      setExactFeature("Levée standard", `${liftMm} mm`, /^levee standard(?: selon modeles)?$/i);
    }

    if (typeof targetWeightKg === "number" && Number.isFinite(targetWeightKg) && targetWeightKg > 0) {
      const formattedWeight = Number.isInteger(targetWeightKg)
        ? String(targetWeightKg)
        : String(targetWeightKg).replace(".", ",");
      setExactFeature("Poids", `${formattedWeight} kg`, /^poids(?: selon modeles)?$/i);
    }

    // Ces valeurs varient suivant le mât mais ne figurent pas dans la désignation
    // commerciale de la référence. Si Stockman ne nous a fourni qu'une plage
    // familiale "selon modèles", on la retire plutôt que d'inventer une valeur.
    const genericFamilyValue = /\bselon\s+modeles?\b|\bde\s+\d[\d\s.,]*\s+a\s+\d/i;
    for (let index = exactFeaturePairs.length - 1; index >= 0; index -= 1) {
      const feature = exactFeaturePairs[index];
      const key = exactKey(feature.label);
      const isVariantDimension = /^(levee libre|hauteur de mat abaisse|hauteur de mat deploye)/i.test(key);
      if (isVariantDimension && genericFamilyValue.test(
        `${feature.label} ${feature.value}`
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase(),
      )) {
        exactFeaturePairs.splice(index, 1);
      }
    }

    return {
      shortDescription,
      detailedDescription,
      images,
      documents,
      features: exactFeaturePairs.slice(0, 50),
    };
  }, {
    reference: product.reference,
    designation: product.designation,
    weightKg: product.weightKg,
  }).catch(() => ({
    shortDescription: null,
    detailedDescription: null,
    images: [],
    documents: [],
    features: [],
  }));

  const merged = { ...product, ...enrichment };

  if (!merged.images.length || !merged.detailedDescription) {
    const diagnostic = await enrichmentDomDiagnostic(page, product.reference);
    console.warn(
      `[STOCKMAN ENRICHMENT DIAGNOSTIC] ${product.reference}\n${diagnostic}`,
    );
  }

  return merged;
}

async function readStockmanProduct(
  context: BrowserContext,
  reference: string,
  productUrl: string,
): Promise<StockmanProduct> {
  const normalizedReference = normalizeReference(reference);
  const sourceUrl = validateStockmanUrl(productUrl.trim());

  const page = await context.newPage();
  const networkAudit: StockmanNetworkAuditEntry[] = [];

  page.on("response", (response) => {
    try {
      const request = response.request();
      const type = request.resourceType();
      const url = response.url();
      if (
        /(^|\.)stockman\.fr/i.test(new URL(url).hostname)
        && (type === "document" || type === "xhr" || type === "fetch")
      ) {
        networkAudit.push({
          type,
          status: response.status(),
          url: url.slice(0, 900),
        });
      }
    } catch {
      // Diagnostic uniquement : ne jamais perturber la lecture produit.
    }
  });

  try {
    await page.goto(sourceUrl, {
      waitUntil: "domcontentloaded",
      timeout: 45_000,
    });

    await page.waitForTimeout(1_200);

    const bodyText = await page.locator("body").innerText();

    const pageTitle = await page
      .locator("h1")
      .first()
      .textContent()
      .catch(() => null);

    if (await isStockmanLoginPage(page)) {
      throw new Error(
        "La session Stockman a expiré. Régénérez stockman-auth.json puis relancez la synchronisation.",
      );
    }

    // V2.8.4 : Stockman hydrate parfois le tableau commercial après le DOM initial.
    // On attend brièvement soit les cellules commerciales, soit une ligne contenant
    // la référence, sans bloquer le diagnostic si elles n'arrivent jamais.
    await page.waitForFunction(
      (ref) => {
        const hasCommercialCell = Boolean(
          document.querySelector("[id*='stock_article'], [id*='price_by_qty']"),
        );
        const hasReference = (document.body?.innerText ?? "").toUpperCase().includes(ref);
        return hasCommercialCell && hasReference;
      },
      normalizedReference,
      { timeout: 8_000 },
    ).catch(() => undefined);

    // V2.8.7 : lecture prioritaire de la ligne commerciale structurée.
    let structuredProduct = await readStructuredCommercialRow(
      page,
      normalizedReference,
      page.url(),
      pageTitle,
    );
    if (structuredProduct) return await enrichStockmanProduct(page, structuredProduct);

    // Certaines URL découvertes sont des pages catégorie : la référence y est
    // visible dans une carte produit (ex. EFT260), mais prix/stock ne sont présents
    // que sur la fiche détaillée. On suit automatiquement le lien de la référence
    // dans le même contexte Playwright authentifié, puis on relit le tableau.
    const detailUrl = await page.evaluate((ref) => {
      const normalize = (value: string | null | undefined) =>
        (value ?? "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim().toUpperCase();
      const anchors = Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href]"));

      const exact = anchors.find((anchor) =>
        normalize(anchor.textContent) === ref
        || normalize(anchor.getAttribute("title")) === ref
        || normalize(anchor.querySelector("h1,h2,h3,h4,strong,b")?.textContent) === ref
      );
      if (exact?.href) return exact.href;

      const encoded = encodeURIComponent(ref).toUpperCase();
      const byHref = anchors.find((anchor) => {
        const href = anchor.href.toUpperCase();
        return href.includes(`--${encoded}.ASPX`) || href.includes(`-${encoded}.ASPX`);
      });
      return byHref?.href ?? null;
    }, normalizedReference).catch(() => null);

    if (detailUrl && detailUrl !== page.url()) {
      const validatedDetailUrl = validateStockmanUrl(detailUrl);
      await page.goto(validatedDetailUrl, { waitUntil: "domcontentloaded", timeout: 45_000 });
      await page.waitForTimeout(1_200);
      await page.waitForFunction(
        (ref) => {
          const body = (document.body?.innerText ?? "").toUpperCase();
          return body.includes(ref) && Boolean(document.querySelector("[id*='stock_article'], [id*='price_by_qty']"));
        },
        normalizedReference,
        { timeout: 8_000 },
      ).catch(() => undefined);

      const detailTitle = await page.locator("h1").first().textContent().catch(() => null);
      structuredProduct = await readStructuredCommercialRow(
        page,
        normalizedReference,
        page.url(),
        detailTitle,
      );
      if (structuredProduct) return await enrichStockmanProduct(page, structuredProduct);
    }

    // Le fallback texte doit porter sur la page réellement atteinte (catégorie ou détail).
    const currentBodyText = await page.locator("body").innerText();
    const currentPageTitle = await page.locator("h1").first().textContent().catch(() => pageTitle);

    try {
      const parsedProduct = parseStockmanProduct({
        bodyText: currentBodyText,
        reference: normalizedReference,
        sourceUrl: page.url(),
        pageTitle: currentPageTitle,
      });
      return await enrichStockmanProduct(page, parsedProduct);
    } catch (error) {
      const baseMessage = error instanceof Error ? error.message : "Lecture Stockman impossible.";
      const diagnostic = await diagnosticWindow(page, currentBodyText, normalizedReference);
      const sessionAudit = await buildSessionAudit(context, page, networkAudit);
      throw new Error(
        `${baseMessage}\n[DIAGNOSTIC STOCKMAN]\n${diagnostic}\n[SESSION STOCKMAN]\n${JSON.stringify(sessionAudit, null, 2)}`,
      );
    }
  } finally {
    await page.close().catch(() => undefined);
  }
}

export async function getStockmanProduct(
  reference: string,
  productUrl: string,
): Promise<StockmanProduct> {
  const { browser, context } = await openStockmanBrowser();

  try {
    return await readStockmanProduct(context, reference, productUrl);
  } finally {
    await context.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
  }
}

export async function getStockmanProducts(
  targets: Array<{ reference: string; productUrl: string }>,
): Promise<Array<{ product?: StockmanProduct; error?: string }>> {
  const { browser, context } = await openStockmanBrowser();

  try {
    const results: Array<{ product?: StockmanProduct; error?: string }> = [];

    for (const target of targets) {
      try {
        results.push({
          product: await readStockmanProduct(
            context,
            target.reference,
            target.productUrl,
          ),
        });
      } catch (error) {
        results.push({
          error:
            error instanceof Error
              ? error.message
              : "Lecture Stockman impossible.",
        });
      }
    }

    return results;
  } finally {
    await context.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
  }
}
