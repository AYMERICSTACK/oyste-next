import type { ErpFamilyCategory } from "../types";

export type ParsedErpReference = {
  family: string;
  category: ErpFamilyCategory;
  installation?: string;
  conception?: string;
  chargeKg?: number;
  reachMm?: number;
  spanMm?: number;
  heightMm?: number;
  widthMm?: number;
};

type FamilyDefinition = {
  code: string;
  category: ErpFamilyCategory;
  label: string;
  match: (reference: string) => boolean;
  parse: (reference: string, label?: string) => ParsedErpReference;
};

function normalizeReference(reference: string) {
  return reference.trim().toUpperCase().replace(/\s+/g, "");
}

function parseNumber(value?: string) {
  if (!value) return undefined;
  const normalized = value.replace(",", ".");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseChargeFromLabel(label?: string) {
  const match = label?.match(/(\d+(?:[,.]\d+)?)\s*kg/i);
  const value = parseNumber(match?.[1]);
  return value === undefined ? undefined : Math.round(value);
}

function parseReachFromLabel(label?: string) {
  const match = label?.match(/port[ée]e?\s*:??\s*(\d+(?:[,.]\d+)?)\s*m/i);
  const value = parseNumber(match?.[1]);
  return value === undefined ? undefined : Math.round(value * 1000);
}

function parsePotence(reference: string, label?: string): ParsedErpReference {
  const ref = normalizeReference(reference);
  const family = ref.slice(0, 3);
  const compact = ref.match(/^(PFI|PFT|PMI|PMT)(\d+)(\d{4})$/);
  const ouvrage = ref.match(/^(PFI|PFT|PMI|PMT)(\d+)KG(\d+)MM$/);
  const rawCharge = compact?.[2] ?? ouvrage?.[2];
  const rawReach = compact?.[3] ?? ouvrage?.[3];

  return {
    family,
    category: "potence",
    installation: family.startsWith("PF") ? "fut" : "murale",
    conception: family.endsWith("I") ? "inversee" : "triangulee",
    chargeKg: rawCharge ? Number.parseInt(rawCharge, 10) : parseChargeFromLabel(label),
    reachMm: rawReach ? Number.parseInt(rawReach, 10) : parseReachFromLabel(label),
  };
}

function parsePortique(reference: string, label?: string): ParsedErpReference {
  const ref = normalizeReference(reference);
  const match = ref.match(/^PORT(\d+)(\d{4})(\d{4})$/);

  return {
    family: "PORT",
    category: "portique",
    chargeKg: match?.[1] ? Number.parseInt(match[1], 10) : parseChargeFromLabel(label),
    spanMm: match?.[2] ? Number.parseInt(match[2], 10) : undefined,
    heightMm: match?.[3] ? Number.parseInt(match[3], 10) : undefined,
  };
}

function parsePalan(reference: string, label?: string): ParsedErpReference {
  const ref = normalizeReference(reference);
  const family = ref.match(/^[A-Z]+/)?.[0] ?? ref;

  return {
    family,
    category: "palan",
    chargeKg: parseChargeFromLabel(label),
  };
}

function parseGeneric(reference: string): ParsedErpReference {
  const ref = normalizeReference(reference);
  const family = ref.match(/^[A-Z]+/)?.[0] ?? ref;

  return {
    family,
    category: "produit",
  };
}

export const ERP_FAMILY_DEFINITIONS: FamilyDefinition[] = [
  { code: "PFI", category: "potence", label: "Potence sur fût inversée", match: (reference) => /^PFI/.test(normalizeReference(reference)), parse: parsePotence },
  { code: "PFT", category: "potence", label: "Potence sur fût triangulée", match: (reference) => /^PFT/.test(normalizeReference(reference)), parse: parsePotence },
  { code: "PMI", category: "potence", label: "Potence murale inversée", match: (reference) => /^PMI/.test(normalizeReference(reference)), parse: parsePotence },
  { code: "PMT", category: "potence", label: "Potence murale triangulée", match: (reference) => /^PMT/.test(normalizeReference(reference)), parse: parsePotence },
  { code: "PORT", category: "portique", label: "Portique acier déplaçable", match: (reference) => /^PORT/.test(normalizeReference(reference)), parse: parsePortique },
  { code: "CB", category: "palan", label: "Palan manuel à chaîne KITO CB", match: (reference) => /^CB\d+/.test(normalizeReference(reference)), parse: parsePalan },
];

export function parseErpReference(reference: string, label?: string): ParsedErpReference {
  const definition = ERP_FAMILY_DEFINITIONS.find((item) => item.match(reference));
  return definition ? definition.parse(reference, label) : parseGeneric(reference);
}

export function getFamilyLabel(code: string, category: ErpFamilyCategory) {
  const definition = ERP_FAMILY_DEFINITIONS.find((item) => item.code === code);
  if (definition) return definition.label;

  if (category === "portique") return "Portiques";
  if (category === "potence") return "Potences";
  if (category === "palan") return "Palans";
  if (category === "accessoire") return "Accessoires";

  return code;
}
