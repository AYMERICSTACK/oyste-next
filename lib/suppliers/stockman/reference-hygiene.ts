const KNOWN_FALSE_REFERENCE_TOKENS = new Set([
  "CRANE",
  "DAY-TO-DAY",
  "DELAYS",
  "SURFACE",
  "GROUND",
  "HANDLING",
  "OPERATOR",
  "VARY",
  "TIME",
]);

export function normalizeStockmanReferenceToken(value: string) {
  return value.trim().toUpperCase().replace(/[,:;]+$/, "");
}

/**
 * V2.8.1 — Les fiches Stockman mélangent références et caractéristiques
 * techniques. Ces formes sont très fréquentes dans les tableaux/paragraphes
 * mais ne sont pas des références fournisseur.
 */
export function isStockmanTechnicalToken(value: string) {
  const token = normalizeStockmanReferenceToken(value).replace(/\s+/g, "");
  if (!token) return true;

  // Dimensions : 1665X1170X1900, 400X554X79, 476X340, 595X605X191…
  if (/^\d+(?:[.,]\d+)?(?:X\d+(?:[.,]\d+)?){1,3}(?:MM|CM|M)?$/.test(token)) return true;

  // Grandeurs électriques / batteries : 220V, 24V, 20AH, 48V\/10AH…
  if (/^\d+(?:[.,]\d+)?(?:V|KV|A|MA|AH|WH|KWH|W|KW|HZ)(?:\/\d+(?:[.,]\d+)?(?:V|KV|A|MA|AH|WH|KWH|W|KW|HZ))?$/.test(token)) return true;

  // Masse / capacité brute : 500G, 250KG, 1T, 2T…
  if (/^\d+(?:[.,]\d+)?(?:MG|G|KG|T)$/.test(token)) return true;

  // Plages numériques utilisées dans les caractéristiques : 90-120, 365-770…
  if (/^\d+(?:[.,]\d+)?-\d+(?:[.,]\d+)?$/.test(token)) return true;

  // Pourcentages, angles et dimensions typographiques isolées.
  if (/^\d+(?:[.,]\d+)?(?:%|°)$/.test(token)) return true;

  return false;
}

export function isKnownFalseStockmanReference(value: string) {
  const token = normalizeStockmanReferenceToken(value);

  // V2.12.8.2 — un mot de phrase terminé par un point n'est jamais une
  // référence commerciale Stockman. C'est précisément la forme des faux
  // positifs capturés dans les descriptions longues (COMPARTIMENTS., EXCL.,
  // FIXE., INTERNE., ITS., etc.). On conserve en revanche les vraies
  // références alphabétiques courtes sans ponctuation (DX, RSS, RLC, LP...).
  if (/^[A-ZÀ-Ÿ]{3,}\.$/.test(token)) return true;

  return KNOWN_FALSE_REFERENCE_TOKENS.has(token) || isStockmanTechnicalToken(token);
}

export function knownFalseStockmanReferences() {
  return [...KNOWN_FALSE_REFERENCE_TOKENS];
}
