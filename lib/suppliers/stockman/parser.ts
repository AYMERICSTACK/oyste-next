import type { StockmanProduct } from "@/lib/suppliers/stockman/types";

type ParseInput = {
  bodyText: string;
  reference: string;
  sourceUrl: string;
  pageTitle?: string | null;
};

function normalize(value: string) {
  return value.replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ").trim();
}

function numberFromFrench(value: string) {
  return Number(value.replace(/\s/g, "").replace(",", "."));
}

function designationFromWindow(lines: string[], reference: string, pageTitle?: string | null) {
  const referenceIndex = lines.findIndex((line) => line.toUpperCase() === reference.toUpperCase());
  const candidates = referenceIndex >= 0 ? lines.slice(referenceIndex + 1, referenceIndex + 6) : [];
  const designation = candidates.find((line) =>
    line.length > 8
    && !/^poids\s*:/i.test(line)
    && !/^code[- ]?barres?\s*:/i.test(line)
    && !/^catalogue\b/i.test(line)
    && !/€/.test(line),
  );

  if (designation) return designation;
  if (pageTitle) return normalize(pageTitle.replace(/\s*[-|]\s*Stockman.*$/i, ""));
  return reference;
}

export function parseStockmanProduct({ bodyText, reference, sourceUrl, pageTitle }: ParseInput): StockmanProduct {
  const normalizedReference = normalize(reference).toUpperCase();
  const lines = bodyText.split(/\r?\n/).map(normalize).filter(Boolean);
  const referenceIndex = lines.findIndex((line) => line.toUpperCase() === normalizedReference);

  if (referenceIndex < 0) {
    throw new Error(`La référence ${normalizedReference} n'a pas été trouvée sur cette fiche Stockman.`);
  }

  const nextReferenceIndex = lines.findIndex((line, index) =>
    index > referenceIndex
    && index <= referenceIndex + 20
    && /^[A-Z0-9][A-Z0-9./_-]{2,24}$/.test(line)
    && line.toUpperCase() !== normalizedReference,
  );
  const endIndex = nextReferenceIndex > referenceIndex ? nextReferenceIndex : referenceIndex + 20;
  const productLines = lines.slice(referenceIndex, endIndex);
  const productText = productLines.join(" ");

  const weightMatch = productText.match(/Poids\s*:\s*(\d+(?:[.,]\d+)?)\s*kg/i);

  // Stockman n'affiche pas toujours le stock et le prix sur la même ligne.
  // L'ancien parseur exigeait strictement "<stock> <prix> € HT", ce qui faisait
  // échouer la préparation des brouillons alors que la fiche était bien ouverte.
  const legacyCommercialMatch = productText.match(/\b(\d+)\s+(\d+(?:[.,]\d+)?)\s*€\s*HT\b/i);
  const explicitStockMatch = productText.match(/\bStock\s*:?\s*(\d+)\b/i);
  const priceMatch =
    productText.match(/\b(?:Prix(?:\s+unitaire)?(?:\s+HT)?\s*:?\s*)?(\d[\d\s]*(?:[.,]\d{2}))\s*€(?:\s*HT)?\b/i);

  let stock: number | null = legacyCommercialMatch ? Number.parseInt(legacyCommercialMatch[1], 10) : null;
  let purchasePriceExVat: number | null = legacyCommercialMatch ? numberFromFrench(legacyCommercialMatch[2]) : null;

  if (stock === null && explicitStockMatch) stock = Number.parseInt(explicitStockMatch[1], 10);
  const stockOnRequest = /nous\s+consulter/i.test(productText);
  if (purchasePriceExVat === null && priceMatch) purchasePriceExVat = numberFromFrench(priceMatch[1]);
  // V2.12.7.1 — certains accessoires sont réellement tarifés « Nous consulter ».
  // Ce n'est pas une erreur de scraping : on conserve un marqueur explicite
  // et le brouillon stockera un PA null afin d'interdire tout faux prix à 0 €.
  const priceOnRequest = purchasePriceExVat === null && /nous\s+consulter/i.test(productText);

  // Sur les tableaux distributeur, le stock est fréquemment une cellule numérique
  // indépendante placée juste avant le prix.
  if (stock === null && priceMatch) {
    const beforePrice = productText.slice(0, priceMatch.index ?? 0);
    const standaloneNumbers = [...beforePrice.matchAll(/(?:^|\s)(\d{1,6})(?=\s|$)/g)];
    const candidate = standaloneNumbers.at(-1)?.[1];
    if (candidate) stock = Number.parseInt(candidate, 10);
  }

  const weightKg = weightMatch ? numberFromFrench(weightMatch[1]) : null;

  if ((!stockOnRequest && (stock === null || !Number.isFinite(stock))) || (!priceOnRequest && (purchasePriceExVat === null || !Number.isFinite(purchasePriceExVat)))) {
    throw new Error(
      `Données commerciales introuvables pour ${normalizedReference} (stock=${stock ?? "?"}, prix=${purchasePriceExVat ?? "?"}).`,
    );
  }

  return {
    reference: normalizedReference,
    designation: designationFromWindow(lines, normalizedReference, pageTitle),
    purchasePriceExVat: purchasePriceExVat ?? 0,
    priceOnRequest,
    stock: stock ?? 0,
    stockOnRequest,
    weightKg,
    sourceUrl,
    readAt: new Date().toISOString(),
  };
}
