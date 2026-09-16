import type { CartTechnicalLine } from "@/lib/cart/types";

export type KitoChainWeightRule = {
  baseLiftM: number;
  additionalWeightPerMeterKg: number;
  source: "KITO_CATALOG";
};

const CB_RULES: Record<string, KitoChainWeightRule> = {
  CB005: { baseLiftM: 3, additionalWeightPerMeterKg: 1.5, source: "KITO_CATALOG" },
  CB010: { baseLiftM: 3, additionalWeightPerMeterKg: 1.8, source: "KITO_CATALOG" },
  CB015: { baseLiftM: 3, additionalWeightPerMeterKg: 2.1, source: "KITO_CATALOG" },
  CB020: { baseLiftM: 3, additionalWeightPerMeterKg: 2.3, source: "KITO_CATALOG" },
  CB025: { baseLiftM: 3, additionalWeightPerMeterKg: 2.7, source: "KITO_CATALOG" },
  CB030: { baseLiftM: 3, additionalWeightPerMeterKg: 3.2, source: "KITO_CATALOG" },
  CB050: { baseLiftM: 3, additionalWeightPerMeterKg: 4.4, source: "KITO_CATALOG" },
};

const CX_RULES: Record<string, KitoChainWeightRule> = {
  CX003: { baseLiftM: 3, additionalWeightPerMeterKg: 0.4, source: "KITO_CATALOG" },
  CX005: { baseLiftM: 3, additionalWeightPerMeterKg: 0.9, source: "KITO_CATALOG" },
  CX010: { baseLiftM: 3, additionalWeightPerMeterKg: 1.8, source: "KITO_CATALOG" },
};

const LB_PER_METER: Record<string, number> = {
  "008": 0.7,
  "010": 0.7,
  "016": 1.1,
  "025": 1.7,
  "032": 2.3,
  "063": 4.7,
  "090": 7,
};

const LX_PER_METER: Record<string, number> = {
  "003": 0.2,
  "005": 0.4,
};

const ER2_PER_METER: Record<string, number> = {
  "001": 0.42,
  "003": 0.42,
  "005": 0.81,
  "010": 1.33,
  "016": 2.3,
  "020": 2.3,
  "025": 2.8,
  "032": 4.7,
  "050": 5.6,
};

function normalizedCode(code?: string) {
  return String(code || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function liftEncodedInCode(code: string) {
  const match = code.match(/HL(15|30)$/);
  if (!match) return null;
  return match[1] === "15" ? 1.5 : 3;
}

export function getKitoChainWeightRule(code?: string): KitoChainWeightRule | null {
  const normalized = normalizedCode(code);
  if (!normalized) return null;

  if (CB_RULES[normalized]) return CB_RULES[normalized];
  if (CX_RULES[normalized]) return CX_RULES[normalized];

  const lb = normalized.match(/^LB(008|010|016|025|032|063|090)HL(?:15|30)$/);
  if (lb) {
    return {
      baseLiftM: liftEncodedInCode(normalized) || 1.5,
      additionalWeightPerMeterKg: LB_PER_METER[lb[1]],
      source: "KITO_CATALOG",
    };
  }

  const lx = normalized.match(/^LX(003|005)HL(?:15|30)$/);
  if (lx) {
    return {
      baseLiftM: liftEncodedInCode(normalized) || 1.5,
      additionalWeightPerMeterKg: LX_PER_METER[lx[1]],
      source: "KITO_CATALOG",
    };
  }

  // ER2 fixe ou associé à un chariot (M / SG / SP) : le poids de chaîne
  // supplémentaire dépend du palan ER2, pas du type de chariot.
  const er2 = normalized.match(/^ER2(?:M|SG|SP)?(001|003|005|010|016|020|025|032|050)/);
  if (er2) {
    const perMeter = ER2_PER_METER[er2[1]];
    if (perMeter !== undefined) {
      return { baseLiftM: 3, additionalWeightPerMeterKg: perMeter, source: "KITO_CATALOG" };
    }
  }

  return null;
}

function parseMeters(value: string) {
  const normalized = value
    .toLowerCase()
    .replace(/,/g, ".")
    .replace(/\s+/g, " ")
    .trim();

  const explicitMeters = normalized.match(/(-?\d+(?:\.\d+)?)\s*m(?:\b|$)/i);
  if (explicitMeters) {
    const meters = Number(explicitMeters[1]);
    return Number.isFinite(meters) && meters > 0 ? meters : null;
  }

  const numericOnly = normalized.match(/^(-?\d+(?:\.\d+)?)$/);
  if (numericOnly) {
    const meters = Number(numericOnly[1]);
    return Number.isFinite(meters) && meters > 0 ? meters : null;
  }

  return null;
}

export function getRequestedKitoLiftM(technicalLines?: CartTechnicalLine[]) {
  if (!technicalLines?.length) return null;

  const candidates = technicalLines.filter((line) => {
    const label = line.label.toLowerCase();
    return (
      label.includes("hauteur de levage") ||
      label.includes("hauteur levage") ||
      label.includes("levée") ||
      label.includes("levee") ||
      label.includes("longueur de chaîne") ||
      label.includes("longueur de chaine")
    );
  });

  for (const line of candidates) {
    const meters = parseMeters(line.value);
    if (meters !== null) return meters;
  }

  return null;
}

export function calculateKitoDynamicWeightKg(input: {
  supplier?: string;
  code?: string;
  baseWeightKg?: number;
  technicalLines?: CartTechnicalLine[];
}) {
  const supplier = String(input.supplier || "").trim();
  const baseWeightKg = Number(input.baseWeightKg);

  if (!/^KITO$/i.test(supplier) || !Number.isFinite(baseWeightKg) || baseWeightKg <= 0) {
    return input.baseWeightKg;
  }

  const rule = getKitoChainWeightRule(input.code);
  if (!rule) return baseWeightKg;

  const requestedLiftM = getRequestedKitoLiftM(input.technicalLines);
  if (requestedLiftM === null || requestedLiftM <= rule.baseLiftM) return baseWeightKg;

  const extraLiftM = requestedLiftM - rule.baseLiftM;
  const total = baseWeightKg + extraLiftM * rule.additionalWeightPerMeterKg;

  // Le transport n'a pas besoin de plus de précision qu'au gramme.
  return Math.round(total * 1000) / 1000;
}
