import { getCustomerProductDescription, isSupplierPlaceholder, type CatalogueProduct } from "@/lib/catalogue/repository";

export type SmartDescriptionSection = {
  introduction: string[];
  technicalSpecs: { label: string; value: string }[];
  strengths: string[];
  advice: string[];
  documents: string[];
  remainingNotes: string[];
};

const TECHNICAL_LABELS: { label: string; patterns: string[] }[] = [
  { label: "Capacité de levage", patterns: ["CMU", "Capacité de levage", "Capacité"] },
  { label: "Portée", patterns: ["Portée", "Longueur de flèche"] },
  { label: "Hauteur sous fer", patterns: ["Hauteur sous fer"] },
  { label: "Hauteur de travail", patterns: ["Hauteur de travail", "Hauteur de levée", "Hauteur maxi", "Hauteur maximum"] },
  { label: "Charge admissible", patterns: ["Poids admissible", "Charge admissible", "Charge maximum", "Capacité de charge"] },
  { label: "Dimensions", patterns: ["Dimensions", "Dimensions hors tout"] },
  { label: "Largeur", patterns: ["Largeur", "Largeur de marches", "Largeur des fourches"] },
  { label: "Longueur", patterns: ["Longueur"] },
  { label: "Poids", patterns: ["Poids"] },
  { label: "Vitesse de levage", patterns: ["Vitesse de levage"] },
  { label: "Personnel requis", patterns: ["Personnel requis pour le montage", "Personnel requis"] },
  { label: "Montage", patterns: ["Montage"] },
  { label: "Revêtement", patterns: ["Revêtement"] },
  { label: "Roues", patterns: ["Roues"] },
  { label: "Norme", patterns: ["Norme"] },
  { label: "Utilisation", patterns: ["Usage", "Utilisation"] },
  { label: "Déplacement", patterns: ["Déplacement"] },
];

const STRENGTH_STARTERS = [
  "montage facile",
  "démontable",
  "grande souplesse",
  "faible poids",
  "livré avec",
  "conception robuste",
  "équipé",
  "larges marches",
  "chaîne de sécurité",
  "roues en",
  "poutre de roulement",
  "compact",
  "compacte",
  "polyvalent",
  "polyvalente",
  "pratique",
  "facile d’utilisation",
  "se transporte",
  "levée manuelle",
  "chargeur intégré",
  "bouton d'arrêt",
  "prise usb",
  "rayon de braquage",
  "grande stabilité",
  "sécurisé",
  "antidérapant",
  "antidérapantes",
];

const ADVICE_STARTERS = [
  "pensez à",
  "attention",
  "pour une utilisation",
  "pour tout complément",
  "consultez",
];

const DOCUMENT_STARTERS = [
  "veuillez trouver plus d’informations",
  "veuillez trouver plus d'informations",
  "voir le détail",
  "fiche technique",
  "fiches techniques",
  "documentation",
  "téléchargez",
  "disponible en téléchargement",
];

function normaliseSpaces(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

const DANGLING_WORDS = new Set([
  "de",
  "du",
  "des",
  "le",
  "la",
  "les",
  "un",
  "une",
  "pour",
  "par",
  "avec",
  "sans",
  "sur",
  "sous",
  "dans",
  "dont",
  "et",
  "ou",
  "à",
  "au",
  "aux",
  "en",
  "que",
  "qui",
  "son",
  "sa",
  "ses",
  "leur",
  "leurs",
]);

const WEAK_TRAILING_WORDS = new Set([
  "faible",
  "faibles",
  "grand",
  "grande",
  "grandes",
  "petit",
  "petite",
  "petites",
  "maximum",
  "minimum",
  "maxi",
  "mini",
  "min",
  "max",
]);

const INCOMPLETE_FRAGMENT_PATTERNS = [
  /\bd[uû]e?\s+[aà]\s+son\s+faible$/i,
  /\bgrande?\s+souplesse\s+de$/i,
  /\bpour\s+le$/i,
  /\bpour\s+la$/i,
  /\bpour\s+les$/i,
  /\blivr[ée]\s+avec$/i,
  /\bmaximum\s*:?\s*[^a-z0-9]*min$/i,
];

function normalizeForQuality(value: string) {
  return normaliseSpaces(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[.,;:!?]+$/g, "")
    .trim();
}

function isIncompleteFragment(value: string) {
  const normalized = normalizeForQuality(value);
  if (!normalized) return true;
  if (INCOMPLETE_FRAGMENT_PATTERNS.some((pattern) => pattern.test(normalized))) return true;

  const words = normalized.split(" ").filter(Boolean);
  const lastWord = words.at(-1);
  if (lastWord && WEAK_TRAILING_WORDS.has(lastWord)) return true;

  const lastTwo = words.slice(-2).join(" ");
  const lastThree = words.slice(-3).join(" ");
  return ["son faible", "sa faible", "leur faible", "leurs faibles", "a son", "à son"].includes(lastTwo) ||
    ["du a son", "due a son", "dû a son", "grande souplesse de"].includes(lastThree);
}

function endsWithDanglingWord(value: string) {
  const words = normaliseSpaces(value)
    .toLowerCase()
    .replace(/[.,;:!?]+$/g, "")
    .split(" ")
    .filter(Boolean);

  const lastWord = words.at(-1);
  return !!lastWord && DANGLING_WORDS.has(lastWord);
}

function trimBeforeAdvice(value: string) {
  return normaliseSpaces(
    value
      .split(/\b(?:pensez à|attention|veuillez|consultez|voir le détail|fiche technique|documentation)\b/i)[0] || value,
  );
}

function isProbablyCompleteText(value: string, minLength = 12) {
  const clean = normaliseSpaces(value);
  if (!clean) return false;
  if (clean.length < minLength && !/\d/.test(clean)) return false;
  if (endsWithDanglingWord(clean)) return false;
  if (isIncompleteFragment(clean)) return false;
  return true;
}

function cleanDisplayText(value: string) {
  return trimBeforeAdvice(value)
    .replace(/\s+([:;,.])/g, "$1")
    .replace(/[;,:-]+$/g, "")
    .trim();
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function uniqueByLabel(items: { label: string; value: string }[]) {
  const seen = new Set<string>();

  return items
    .map((item) => ({ label: item.label, value: cleanDisplayText(item.value) }))
    .filter((item) => {
      const key = item.label.toLowerCase();
      if (seen.has(key) || !isProbablyCompleteText(item.value, 2)) return false;
      seen.add(key);
      return true;
    });
}

function uniqueList(items: string[]) {
  const seen = new Set<string>();
  return items
    .map(cleanDisplayText)
    .filter((item) => {
      const key = item.toLowerCase();
      if (!isProbablyCompleteText(item, 18) || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function splitDescriptionIntoSegments(description: string) {
  const clean = normaliseSpaces(description)
    .replace(/\s+([:;,.])/g, "$1")
    .replace(/([.!?])\s+/g, "$1|SPLIT|");

  const knownStarts = [
    ...TECHNICAL_LABELS.flatMap((entry) => entry.patterns),
    "Montage facile",
    "Démontable",
    "Grande souplesse",
    "Roues en",
    "Poutre de roulement",
    "Revêtement",
    "Livré avec",
    "Pensez à",
    "Norme",
    "Veuillez trouver",
    "Consultez",
    "ATTENTION",
    "Compact",
    "Compacte",
    "Conception robuste",
    "Equipé",
    "Équipé",
    "Larges marches",
    "Chaîne de sécurité",
  ];

  const withMarkers = knownStarts.reduce((text, start) => {
    const regex = new RegExp(`\\s+(${escapeRegex(start)}\\b)`, "gi");
    return text.replace(regex, "|SPLIT|$1");
  }, clean);

  return withMarkers
    .split("|SPLIT|")
    .map(normaliseSpaces)
    .filter(Boolean);
}

function extractTechnicalSpec(segment: string) {
  for (const entry of TECHNICAL_LABELS) {
    for (const pattern of entry.patterns) {
      const regex = new RegExp(`^${escapeRegex(pattern)}\\s*(?:\\([^)]*\\))?\\s*:?\\s*(.+)$`, "i");
      const match = segment.match(regex);
      if (match?.[1]) {
        const value = cleanDisplayText(match[1]);
        if (!isProbablyCompleteText(value, 2)) return null;
        return { label: entry.label, value };
      }
    }
  }

  return null;
}

function startsWithAny(segment: string, starters: string[]) {
  const lower = segment.toLowerCase();
  return starters.some((starter) => lower.startsWith(starter));
}

function isDocumentSegment(segment: string) {
  const lower = segment.toLowerCase();
  return DOCUMENT_STARTERS.some((starter) => lower.includes(starter));
}

function cleanIntroductionSegments(segments: string[]) {
  return segments
    .map((segment) =>
      segment
        .replace(/\bDe fabrication française,?\s*/i, "")
        .replace(/\b[A-Z0-9_-]+\s*:?\s*$/g, "")
        .trim(),
    )
    .filter((segment) => segment.length > 24)
    .slice(0, 3);
}

export function buildSmartDescription(product: CatalogueProduct): SmartDescriptionSection {
  const rawDescription = isSupplierPlaceholder(product.detailedDescription)
    ? getCustomerProductDescription(product)
    : product.detailedDescription || getCustomerProductDescription(product) || "";
  const segments = splitDescriptionIntoSegments(rawDescription);

  const technicalSpecs: { label: string; value: string }[] = [];
  const strengths: string[] = [];
  const advice: string[] = [];
  const documents: string[] = [];
  const introductionCandidates: string[] = [];
  const remainingNotes: string[] = [];

  for (const segment of segments) {
    const technicalSpec = extractTechnicalSpec(segment);

    if (technicalSpec) {
      technicalSpecs.push(technicalSpec);
      continue;
    }

    if (isDocumentSegment(segment)) {
      documents.push(segment);
      continue;
    }

    if (startsWithAny(segment, ADVICE_STARTERS)) {
      advice.push(segment);
      continue;
    }

    if (startsWithAny(segment, STRENGTH_STARTERS)) {
      strengths.push(segment);
      continue;
    }

    if (introductionCandidates.length < 4) {
      introductionCandidates.push(segment);
    } else {
      remainingNotes.push(segment);
    }
  }

  for (const feature of product.features || []) {
    const value = cleanDisplayText(feature.value || "");
    if (feature.label && isProbablyCompleteText(value, 2)) {
      technicalSpecs.push({ label: feature.label, value });
    }
  }

  const optionLabels = product.optionSchema?.map((option) => option.label).filter(Boolean) || [];
  if ((product.variantCount || 0) > 1 && optionLabels.length > 0) {
    technicalSpecs.push({
      label: "Configurations",
      value: `${product.variantCount} variantes selon ${optionLabels.join(", ").toLowerCase()}`,
    });
  }

  const introduction = cleanIntroductionSegments(introductionCandidates);

  return {
    introduction: introduction.length ? introduction : [getCustomerProductDescription(product)].filter(Boolean),
    technicalSpecs: uniqueByLabel(technicalSpecs).slice(0, 12),
    strengths: uniqueList(strengths).slice(0, 10),
    advice: uniqueList(advice).slice(0, 3),
    documents: uniqueList(documents).slice(0, 4),
    remainingNotes: uniqueList(remainingNotes).slice(0, 4),
  };
}
