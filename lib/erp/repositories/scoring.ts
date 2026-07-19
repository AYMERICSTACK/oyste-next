import type { ErpOuvrage, OuvrageMatch, OuvrageSearchCriteria } from "../types";

type DimensionScore = {
  score: number;
  exact: boolean;
  reason?: string;
  checked: boolean;
};

function scoreDimension({
  label,
  value,
  expected,
  weight = 1,
}: {
  label: string;
  value?: number;
  expected?: number;
  weight?: number;
}): DimensionScore | null {
  if (expected === undefined) return { score: 0, exact: true, checked: false };
  if (value === undefined) return null;

  const diff = Math.abs(value - expected);

  return {
    score: diff * weight,
    exact: diff === 0,
    checked: true,
    reason: diff === 0 ? `${label} confirmée` : `${label} la plus proche disponible`,
  };
}

function getConfidence(dimensions: DimensionScore[]) {
  const checked = dimensions.filter((dimension) => dimension.checked);
  if (checked.length === 0) return 0;

  const exactCount = checked.filter((dimension) => dimension.exact).length;
  return Math.round((exactCount / checked.length) * 100);
}

export function scoreOuvrage(ouvrage: ErpOuvrage, criteria: OuvrageSearchCriteria): OuvrageMatch | null {
  if (criteria.family && ouvrage.family !== criteria.family) return null;
  if (criteria.installation && ouvrage.installation && ouvrage.installation !== criteria.installation) return null;
  if (criteria.conception && ouvrage.conception && ouvrage.conception !== criteria.conception) return null;

  const dimensions = [
    scoreDimension({ label: "Charge", value: ouvrage.chargeKg, expected: criteria.chargeKg, weight: 1 }),
    scoreDimension({ label: "Portée", value: ouvrage.reachMm, expected: criteria.reachMm, weight: 0.1 }),
    scoreDimension({ label: "Largeur", value: ouvrage.widthMm, expected: criteria.widthMm, weight: 0.1 }),
    scoreDimension({ label: "Hauteur", value: ouvrage.heightMm, expected: criteria.heightMm, weight: 0.1 }),
    scoreDimension({ label: "Ouverture", value: ouvrage.spanMm, expected: criteria.spanMm, weight: 0.1 }),
  ];

  if (dimensions.some((dimension) => dimension === null)) return null;

  const safeDimensions = dimensions.filter((dimension): dimension is DimensionScore => Boolean(dimension));
  const score = safeDimensions.reduce((total, dimension) => total + dimension.score, 0);
  const exact = safeDimensions.every((dimension) => dimension.exact);
  const reasons = safeDimensions.map((dimension) => dimension.reason).filter((reason): reason is string => Boolean(reason));
  const confidence = getConfidence(safeDimensions);

  return { ouvrage, exact, score, confidence, reasons };
}
