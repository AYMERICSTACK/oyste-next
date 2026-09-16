import {
  STOCKMAN_EQUIVALENCES,
  type StockmanEquivalenceRow,
} from "@/lib/suppliers/stockman/equivalences.generated";
import type { StockmanDiscoveredReference } from "@/lib/suppliers/stockman/catalog-scanner";
import type {
  StockmanCatalogMatch,
  StockmanMatchMethod,
  StockmanMatchSuggestion,
} from "@/lib/suppliers/stockman/types";

export type StockmanMatchCandidate = {
  targetType: "product" | "variant";
  targetId: string;
  productId: string;
  targetName: string;
  supplierCode: string;
  sourceData: unknown;
};

type ScoredCandidate = {
  candidate: StockmanMatchCandidate;
  score: number;
  confidence: number;
  reason: string;
  equivalentReference?: string;
};

type IndexedCandidate = {
  candidate: StockmanMatchCandidate;
  exactReference: string;
  normalizedReference: string;
  normalizedName: string;
};

type StockmanMatcher = {
  match: (item: StockmanDiscoveredReference) => StockmanCatalogMatch;
};

const STOP_WORDS = new Set([
  "a", "au", "aux", "avec", "de", "des", "du", "en", "et", "la", "le", "les", "pour", "par", "sur",
  "un", "une", "plus", "kg", "mm", "cm", "m", "modele", "stockman", "oyste",
]);

const MAX_SUGGESTIONS = 5;
const SUGGESTION_THRESHOLD = 0.52;
const AUTO_SUGGEST_THRESHOLD = 0.72;
const AMBIGUITY_GAP = 0.1;
const MISSING_REFERENCE_THRESHOLD = 0.62;
const MISSING_DESIGNATION_THRESHOLD = 0.38;
const MISSING_FAMILY_THRESHOLD = 0.22;

function referenceSimilarity(left: string, right: string) {
  const a = normalizeStockmanReference(left);
  const b = normalizeStockmanReference(right);
  if (!isUsableNormalizedReference(a) || !isUsableNormalizedReference(b)) return 0;
  if (a === b) return 1;

  const grams = (value: string) => {
    if (value.length < 2) return new Set([value]);
    return new Set(Array.from({ length: value.length - 1 }, (_, index) => value.slice(index, index + 2)));
  };
  const ag = grams(a);
  const bg = grams(b);
  let intersection = 0;
  for (const gram of ag) if (bg.has(gram)) intersection += 1;
  const dice = (2 * intersection) / Math.max(1, ag.size + bg.size);

  let prefix = 0;
  while (prefix < Math.min(a.length, b.length) && a[prefix] === b[prefix]) prefix += 1;
  const prefixScore = prefix / Math.max(a.length, b.length);
  const lengthScore = 1 - Math.min(1, Math.abs(a.length - b.length) / Math.max(a.length, b.length));

  return Math.min(1, dice * 0.62 + prefixScore * 0.25 + lengthScore * 0.13);
}

function sharedMeaningfulTokens(left: string, right: string) {
  const a = tokens(left);
  const b = tokens(right);
  let shared = 0;
  for (const token of a) if (b.has(token)) shared += 1;
  return shared;
}

function exactReferenceKey(value: string) {
  return value.trim().toUpperCase();
}

/** Forme canonique partagée par Stockman, Excel et OYSTE. */
export function normalizeStockmanReference(value: string) {
  return value
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[×✕]/g, "X")
    .replace(/[^A-Z0-9]/g, "");
}

function isUsableNormalizedReference(value: string) {
  return value.length >= 3;
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[×✕]/g, "x")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokens(value: string) {
  return new Set(normalizeText(value).split(/\s+/).filter((token) => token.length > 1 && !STOP_WORDS.has(token)));
}

function textSimilarity(left: string, right: string) {
  const a = tokens(left);
  const b = tokens(right);
  if (!a.size || !b.size) return 0;

  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection += 1;
  const union = new Set([...a, ...b]).size;
  const jaccard = union ? intersection / union : 0;

  const leftNumbers = [...normalizeText(left).matchAll(/\d+(?:[.,]\d+)?/g)].map((match) => match[0].replace(",", "."));
  const rightNumbers = new Set([...normalizeText(right).matchAll(/\d+(?:[.,]\d+)?/g)].map((match) => match[0].replace(",", ".")));
  const numberScore = leftNumbers.length
    ? leftNumbers.filter((number) => rightNumbers.has(number)).length / leftNumbers.length
    : 0;

  return Math.min(1, jaccard * 0.72 + numberScore * 0.28);
}

function sourceRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function isAlreadyLinked(candidate: StockmanMatchCandidate) {
  const source = sourceRecord(candidate.sourceData);
  const stockman = source.stockman && typeof source.stockman === "object" && !Array.isArray(source.stockman)
    ? source.stockman as Record<string, unknown>
    : {};
  return typeof stockman.sourceUrl === "string" && stockman.sourceUrl.length > 0;
}

function suggestionFromScored(entry: ScoredCandidate): StockmanMatchSuggestion {
  return {
    targetType: entry.candidate.targetType,
    targetId: entry.candidate.targetId,
    productId: entry.candidate.productId,
    targetName: entry.candidate.targetName,
    targetReference: entry.candidate.supplierCode,
    confidence: entry.confidence,
    reason: entry.reason,
    equivalentReference: entry.equivalentReference,
  };
}

function safeMatch(
  item: StockmanDiscoveredReference,
  candidate: StockmanMatchCandidate,
  method: StockmanMatchMethod,
  confidence: number,
  reason: string,
  equivalentReference?: string,
  suggestions?: StockmanMatchSuggestion[],
): StockmanCatalogMatch {
  return {
    ...item,
    status: isAlreadyLinked(candidate) ? "already_linked" : "matched",
    matchMethod: method,
    confidence,
    reason,
    equivalentReference,
    suggestions,
    targetType: candidate.targetType,
    targetId: candidate.targetId,
    productId: candidate.productId,
    targetName: candidate.targetName,
    targetReference: candidate.supplierCode,
  };
}

function candidateKey(candidate: StockmanMatchCandidate) {
  return `${candidate.targetType}:${candidate.targetId}`;
}

function uniqueCandidates(candidates: StockmanMatchCandidate[]) {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = candidateKey(candidate);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function addToIndex<T>(index: Map<string, T[]>, key: string, value: T) {
  if (!key) return;
  const entries = index.get(key);
  if (entries) entries.push(value);
  else index.set(key, [value]);
}

function directMatch(
  item: StockmanDiscoveredReference,
  matches: StockmanMatchCandidate[],
  method: "exact" | "normalized",
  confidence: number,
  reason: string,
): StockmanCatalogMatch | null {
  const unique = uniqueCandidates(matches);
  if (unique.length === 1) {
    return safeMatch(
      item,
      unique[0],
      method,
      confidence,
      reason,
      method === "normalized" ? unique[0].supplierCode : undefined,
    );
  }
  if (unique.length > 1) {
    const suggestions = unique.slice(0, MAX_SUGGESTIONS).map((candidate) => suggestionFromScored({
      candidate,
      score: confidence / 100,
      confidence,
      reason: `${reason}, mais plusieurs cibles OYSTE utilisent cette référence.`,
    }));
    return {
      ...item,
      status: "ambiguous",
      matchMethod: method,
      confidence,
      reason: `${reason}, mais ${unique.length} cibles OYSTE correspondent.`,
      candidateCount: unique.length,
      suggestions,
    };
  }
  return null;
}

function rowReferenceKeys(row: StockmanEquivalenceRow) {
  return new Set([
    normalizeStockmanReference(row.supplierReference),
    normalizeStockmanReference(row.productCode),
    normalizeStockmanReference(row.parentCode ?? ""),
  ].filter(isUsableNormalizedReference));
}

function rowLabels(row: StockmanEquivalenceRow) {
  return [row.fullName, row.name].filter((value): value is string => Boolean(value?.trim()));
}

function excelReason(row: StockmanEquivalenceRow, designationScore: number, targetScore: number) {
  const sources: string[] = [];
  if (row.productCode) sources.push(`produit ${row.productCode}`);
  if (row.parentCode) sources.push(`parent ${row.parentCode}`);
  if (designationScore >= 0.85) sources.push("désignation très proche");
  else if (designationScore >= 0.65) sources.push("désignation proche");
  if (targetScore >= 0.85) sources.push("nom OYSTE confirmé");
  return `Correspondance via la feuille STOCKMAN${sources.length ? ` (${sources.join(", ")})` : ""}.`;
}

/**
 * RC4.2 V2.3 : moteur explicable avec score, justification, suggestions
 * classées et conservation des candidats en cas d'ambiguïté.
 */
export function createStockmanEquivalenceMatcher(candidates: StockmanMatchCandidate[]): StockmanMatcher {
  const indexedCandidates: IndexedCandidate[] = uniqueCandidates(candidates)
    .map((candidate) => ({
      candidate,
      exactReference: exactReferenceKey(candidate.supplierCode),
      normalizedReference: normalizeStockmanReference(candidate.supplierCode),
      normalizedName: normalizeText(candidate.targetName),
    }))
    .filter((entry) => entry.exactReference.length > 0);

  const exactIndex = new Map<string, StockmanMatchCandidate[]>();
  const normalizedIndex = new Map<string, StockmanMatchCandidate[]>();
  const candidateNameIndex = new Map<string, StockmanMatchCandidate[]>();

  for (const entry of indexedCandidates) {
    addToIndex(exactIndex, entry.exactReference, entry.candidate);
    if (isUsableNormalizedReference(entry.normalizedReference)) {
      addToIndex(normalizedIndex, entry.normalizedReference, entry.candidate);
    }
    if (entry.normalizedName.length >= 5) {
      addToIndex(candidateNameIndex, entry.normalizedName, entry.candidate);
    }
  }

  const excelReferenceIndex = new Map<string, StockmanEquivalenceRow[]>();
  const excelNameIndex = new Map<string, StockmanEquivalenceRow[]>();

  for (const row of STOCKMAN_EQUIVALENCES) {
    for (const key of rowReferenceKeys(row)) addToIndex(excelReferenceIndex, key, row);
    for (const label of rowLabels(row)) {
      const key = normalizeText(label);
      if (key.length >= 5) addToIndex(excelNameIndex, key, row);
    }
  }

  function candidatesForExcelRow(row: StockmanEquivalenceRow) {
    const matches: StockmanMatchCandidate[] = [];
    for (const rawReference of [row.productCode, row.supplierReference, row.parentCode ?? ""]) {
      const key = normalizeStockmanReference(rawReference);
      if (!isUsableNormalizedReference(key)) continue;
      matches.push(...(normalizedIndex.get(key) ?? []));
    }
    for (const label of rowLabels(row)) {
      matches.push(...(candidateNameIndex.get(normalizeText(label)) ?? []));
    }
    return uniqueCandidates(matches);
  }

  function rankExcelCandidates(item: StockmanDiscoveredReference, rows: StockmanEquivalenceRow[]) {
    const bestPerTarget = new Map<string, ScoredCandidate>();

    for (const row of rows) {
      const rowCandidates = candidatesForExcelRow(row);
      for (const candidate of rowCandidates) {
        const labels = rowLabels(row);
        const designationScore = Math.max(0, ...labels.map((label) => textSimilarity(item.designation, label)));
        const targetScore = Math.max(0, ...labels.map((label) => textSimilarity(label, candidate.targetName)));
        const directTargetScore = textSimilarity(item.designation, candidate.targetName);
        const score = Math.max(directTargetScore, designationScore, targetScore);
        const confidence = Math.min(97, Math.max(70, Math.round(82 + score * 15)));
        const entry: ScoredCandidate = {
          candidate,
          score,
          confidence,
          reason: excelReason(row, designationScore, targetScore),
          equivalentReference: row.productCode || row.supplierReference,
        };
        const key = candidateKey(candidate);
        const current = bestPerTarget.get(key);
        if (!current || entry.score > current.score) bestPerTarget.set(key, entry);
      }
    }

    return [...bestPerTarget.values()].sort((a, b) => b.score - a.score || b.confidence - a.confidence);
  }

  function rankTextSuggestions(item: StockmanDiscoveredReference) {
    return indexedCandidates
      .map(({ candidate }) => {
        const score = textSimilarity(item.designation, candidate.targetName);
        return {
          candidate,
          score,
          confidence: Math.round(score * 100),
          reason: score >= 0.85
            ? "Désignation Stockman très proche du nom OYSTE."
            : score >= 0.72
              ? "Désignation Stockman proche du nom OYSTE."
              : "Ressemblance textuelle partielle avec le nom OYSTE.",
        } satisfies ScoredCandidate;
      })
      .filter((entry) => entry.score >= SUGGESTION_THRESHOLD)
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_SUGGESTIONS);
  }

  function rankReferenceNeighbours(item: StockmanDiscoveredReference) {
    return indexedCandidates
      .map(({ candidate }) => {
        const score = referenceSimilarity(item.reference, candidate.supplierCode);
        return {
          candidate,
          score,
          confidence: Math.round(score * 100),
          reason: `Référence OYSTE proche de ${item.reference} après comparaison alphanumérique.`,
        } satisfies ScoredCandidate;
      })
      .filter((entry) => entry.score >= MISSING_REFERENCE_THRESHOLD)
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_SUGGESTIONS);
  }

  function rankLooseDesignationCandidates(item: StockmanDiscoveredReference) {
    return indexedCandidates
      .map(({ candidate }) => {
        const score = textSimilarity(item.designation, candidate.targetName);
        const shared = sharedMeaningfulTokens(item.designation, candidate.targetName);
        return {
          candidate,
          score,
          confidence: Math.round(score * 100),
          reason: shared >= 2
            ? `${shared} termes métier communs avec la désignation OYSTE.`
            : "Ressemblance de famille produit avec la désignation OYSTE.",
        } satisfies ScoredCandidate;
      })
      .filter((entry) => entry.score >= MISSING_FAMILY_THRESHOLD)
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_SUGGESTIONS);
  }

  function analyzeMissing(item: StockmanDiscoveredReference, normalized: string): StockmanCatalogMatch {
    const exactExcelRows = isUsableNormalizedReference(normalized)
      ? excelReferenceIndex.get(normalized) ?? []
      : [];

    if (exactExcelRows.length) {
      const row = exactExcelRows[0];
      const rowCandidates = uniqueCandidates(exactExcelRows.flatMap(candidatesForExcelRow));
      const suggestions = rowCandidates.slice(0, MAX_SUGGESTIONS).map((candidate) => suggestionFromScored({
        candidate,
        score: Math.max(textSimilarity(item.designation, candidate.targetName), 0.45),
        confidence: Math.max(45, Math.round(textSimilarity(item.designation, candidate.targetName) * 100)),
        reason: "Cible reliée à la même ligne Excel, mais la correspondance n'est pas assez forte pour être automatique.",
        equivalentReference: row.productCode || row.supplierReference,
      }));
      return {
        ...item,
        status: "missing",
        matchMethod: "none",
        confidence: suggestions[0]?.confidence ?? 55,
        missingKind: "excel_unmapped",
        reason: `La référence existe dans la feuille STOCKMAN${row.productCode ? ` (produit ${row.productCode})` : ""}, mais aucune cible OYSTE fiable n'a pu être résolue automatiquement.`,
        equivalentReference: row.productCode || row.supplierReference,
        suggestions,
      };
    }

    const referenceNeighbours = rankReferenceNeighbours(item);
    if (referenceNeighbours.length) {
      const best = referenceNeighbours[0];
      return {
        ...item,
        status: "missing",
        matchMethod: "none",
        confidence: best.confidence,
        missingKind: "reference_close",
        reason: `Aucune égalité exacte, mais ${referenceNeighbours.length} référence(s) OYSTE proche(s) ont été trouvées. Vérification manuelle recommandée.`,
        suggestions: referenceNeighbours.map(suggestionFromScored),
      };
    }

    const loose = rankLooseDesignationCandidates(item);
    if (loose.length && loose[0].score >= MISSING_DESIGNATION_THRESHOLD) {
      const best = loose[0];
      return {
        ...item,
        status: "missing",
        matchMethod: "none",
        confidence: best.confidence,
        missingKind: "designation_close",
        reason: "Aucune référence compatible, mais la désignation ressemble à un produit OYSTE existant. À contrôler avant de conclure à une absence.",
        suggestions: loose.map(suggestionFromScored),
      };
    }

    if (loose.length && sharedMeaningfulTokens(item.designation, loose[0].candidate.targetName) >= 2) {
      return {
        ...item,
        status: "missing",
        matchMethod: "none",
        confidence: loose[0].confidence,
        missingKind: "family_probable",
        reason: "La référence n'est pas reconnue, mais le moteur retrouve une famille produit OYSTE probable grâce aux termes métier communs.",
        suggestions: loose.map(suggestionFromScored),
      };
    }

    return {
      ...item,
      status: "missing",
      matchMethod: "none",
      confidence: 0,
      missingKind: "confirmed_missing",
      reason: "Aucune référence proche, aucune ligne Excel exploitable et aucune désignation/famille OYSTE suffisamment similaire n'ont été trouvées.",
      suggestions: [],
    };
  }

  function match(item: StockmanDiscoveredReference): StockmanCatalogMatch {
    const exactKey = exactReferenceKey(item.reference);
    const exact = directMatch(
      item,
      exactIndex.get(exactKey) ?? [],
      "exact",
      100,
      "Référence Stockman strictement identique à la référence fournisseur OYSTE.",
    );
    if (exact) return exact;

    const normalized = normalizeStockmanReference(item.reference);
    if (isUsableNormalizedReference(normalized)) {
      const normalizedDirect = directMatch(
        item,
        normalizedIndex.get(normalized) ?? [],
        "normalized",
        98,
        "Références identiques après suppression des espaces, tirets, accents et séparateurs.",
      );
      if (normalizedDirect) return normalizedDirect;
    }

    let equivalenceRows = isUsableNormalizedReference(normalized)
      ? excelReferenceIndex.get(normalized) ?? []
      : [];

    if (!equivalenceRows.length) {
      equivalenceRows = excelNameIndex.get(normalizeText(item.designation)) ?? [];
    }

    if (equivalenceRows.length) {
      const ranked = rankExcelCandidates(item, equivalenceRows);
      const suggestions = ranked.slice(0, MAX_SUGGESTIONS).map(suggestionFromScored);
      if (ranked.length === 1) {
        const best = ranked[0];
        return safeMatch(item, best.candidate, "excel", best.confidence, best.reason, best.equivalentReference, suggestions);
      }

      if (ranked.length > 1) {
        const best = ranked[0];
        const second = ranked[1];
        const gap = best.score - second.score;
        if (best.score >= 0.78 && gap >= 0.12) {
          return safeMatch(
            item,
            best.candidate,
            "excel",
            best.confidence,
            `${best.reason} Le meilleur candidat se détache de ${Math.round(gap * 100)} points.`,
            best.equivalentReference,
            suggestions,
          );
        }
        return {
          ...item,
          status: "ambiguous",
          matchMethod: "excel",
          confidence: best.confidence,
          reason: `Plusieurs équivalences Excel restent trop proches (${Math.round(gap * 100)} point(s) d'écart).`,
          candidateCount: ranked.length,
          suggestions,
        };
      }
    }

    const rankedSuggestions = rankTextSuggestions(item);
    if (rankedSuggestions.length) {
      const best = rankedSuggestions[0];
      const second = rankedSuggestions[1];
      const gap = second ? best.score - second.score : 1;
      const suggestions = rankedSuggestions.map(suggestionFromScored);

      if (best.score >= AUTO_SUGGEST_THRESHOLD && gap >= AMBIGUITY_GAP) {
        return {
          ...item,
          status: "suggested",
          matchMethod: "suggestion",
          confidence: best.confidence,
          reason: `${best.reason} Suggestion uniquement : aucune référence ou équivalence Excel ne confirme l'association.`,
          suggestions,
          targetType: best.candidate.targetType,
          targetId: best.candidate.targetId,
          productId: best.candidate.productId,
          targetName: best.candidate.targetName,
          targetReference: best.candidate.supplierCode,
        };
      }

      return {
        ...item,
        status: "ambiguous",
        matchMethod: "suggestion",
        confidence: best.confidence,
        reason: second
          ? `Plusieurs suggestions textuelles sont proches (${Math.round(gap * 100)} point(s) d'écart).`
          : "La ressemblance textuelle est insuffisante pour proposer une association fiable.",
        candidateCount: rankedSuggestions.length,
        suggestions,
      };
    }

    return analyzeMissing(item, normalized);
  }

  return { match };
}

/** Compatibilité avec les appels unitaires existants. */
export function matchStockmanCatalogReference(
  item: StockmanDiscoveredReference,
  candidates: StockmanMatchCandidate[],
): StockmanCatalogMatch {
  return createStockmanEquivalenceMatcher(candidates).match(item);
}
