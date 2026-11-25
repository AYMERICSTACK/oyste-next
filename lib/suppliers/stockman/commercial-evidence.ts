/** Only isolated commercial cells may yield a numeric price or stock. */
export function commercialCellNumber(text: string, kind: "price" | "stock"): number | null {
  const clean = text.replace(/[\u00a0\u202f]/g, " ").trim();
  if (/consulter|r[ée]approvisionnement/i.test(clean)) return null;
  const match = kind === "price"
    ? clean.match(/^(?:Prix(?:\s+unitaire)?(?:\s+HT)?\s*:?\s*)?(\d+(?: \d{3})*(?:[.,]\d{1,2})?)\s*€(?:\s*HT)?(?:\s|$)/i)
    : clean.match(/^(?:Stock\s*:?\s*)?(\d+)$/i);
  if (!match) return null;
  const value = Number(match[1].replace(/ /g, "").replace(",", "."));
  return Number.isFinite(value) ? value : null;
}

export function commercialCellState(text: string | undefined, value: number | null) {
  if (value !== null) return "NUMERIC";
  if (/\b(?:date de r[ée]approvisionnement|resupply date|restock date)\b/i.test(text ?? "")) return "RESTOCK";
  if (/\b(?:nous consulter|(?:stock|prix)?\s*sur demande|on request|upon request|contact us)\b/i.test(text ?? "")) return "ON_REQUEST";
  return text?.trim() ? "UNRECOGNIZED" : "MISSING";
}

/** Model names must occur in an explicit compatibility clause and in this page's rows.
 * No prefix matching: SCGZ1000 must never imply SCGZ1000BSE.
 */
export function explicitCompatibility(description: string, knownReferences: string[]): string[] {
  const clause = description.match(/\b(?:mod[eè]les?|compatible(?:s)?\s+avec)\s*:?\s*([\s\S]+)/i)?.[1];
  if (!clause) return [];
  const tokens = new Set((clause.toUpperCase().match(/[A-Z0-9][A-Z0-9./_-]*/g) ?? []).map(value => value.replace(/[.]$/, "")));
  return [...new Set(knownReferences.filter(reference => tokens.has(reference.trim().toUpperCase())))];
}

export function stockmanUnitPriceEvidence(value: string | undefined) {
  const text = value?.replace(/[  ]/g, " ").trim() ?? "";
  const unit = /^(?:prix\s+unitaire(?:\s+HT)?\s*:?\s*)?\d+(?: \d{3})*(?:[.,]\d{1,2})?\s*€\s*(?:HT|excl\.?\s*VAT)\s*(?:per\s+unit|[àa]\s+l['’]unit[ée])(?=$|[\s\d.,;:)])/i.exec(text);
  if (!unit) return false;
  const remaining = text.slice(unit[0].length).trim();
  return !/^(?:par|per|by)\b/i.test(remaining) && !/\b(?:carton|lot|paquet|palette|pack|colis|box|bundle)\b/i.test(remaining);
}
