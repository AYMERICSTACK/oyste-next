export type StockmanTechnicalFact = { kind: "Dimensions" | "Capacité" | "Hauteur"; value: string };

export function readStockmanTechnicalFacts(text: string): StockmanTechnicalFact[] {
  const normalized = text.replace(/\s+/g, " ").trim();
  const facts: StockmanTechnicalFact[] = [];
  for (const match of normalized.matchAll(/(?<![\d.,])(?:(?:\d{1,3}(?:[ ,]\d{3})+|\d{2,5})(?:[,.]\d+)?\s*(?:mm|cm|m)?\s*[×x]\s*){1,2}(?:\d{1,3}(?:[ ,]\d{3})+|\d{2,5})(?:[,.]\d+)?\s*(?:mm|cm|m)\b/gi)) {
    facts.push({ kind: "Dimensions", value: match[0] });
  }
  for (const match of normalized.matchAll(/\b(?:capacit[ée](?:\s+(?:de charge|maximale))?|(?:load\s+)?capacity|CMU|charge maximale|max(?:imum)?\s+load)\s*(?:(?:de|of|up to|jusqu['’]à)\s*)?[:–-]?\s*(?:de\s+)?(\d[\d .,]*\d|\d)\s*(kg|tonnes?|tons?|t)\b/gi)) {
    facts.push({ kind: "Capacité", value: match[1].trim() + " " + match[2] });
  }
  for (const match of normalized.matchAll(/\b(?:hauteur(?:\s+de lev[ée]e|\s+repli[ée]e)|lift(?:ing)? height|folded height)\s*(?:de|of|up to)?\s*[:–-]?\s*(\d[\d .,]*\d|\d)\s*(mm|cm|m)\b/gi)) {
    facts.push({ kind: "Hauteur", value: match[1].trim() + " " + match[2] });
  }
  return [...new Map(facts.map((fact) => [fact.kind + ":" + fact.value, fact])).values()];
}
