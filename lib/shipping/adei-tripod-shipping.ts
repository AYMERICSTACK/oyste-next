export type AdeiTripodShippingMode = "MESSAGERIE" | "AFFRETEMENT";

export type AdeiTripodShippingInput = {
  weightKg?: number;
  packageLengthCm?: number;
  packageWidthCm?: number;
  packageHeightCm?: number;
};

export type AdeiTripodShippingDecision = {
  mode: AdeiTripodShippingMode;
  reason: "UNDER_3M_MESSAGERIE" | "FROM_3M_AFFRETEMENT_C0";
  affretementCoefficient?: 0;
};

export const ADEI_TRIPOD_MESSAGERIE_MAX_DIMENSION_CM = 300;

function positive(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) && number > 0 ? number : undefined;
}

export function isAdeiTripodCode(code?: string) {
  return /^TRA/i.test(String(code || "").trim());
}

export function resolveAdeiTripodShipping(
  input: AdeiTripodShippingInput,
): AdeiTripodShippingDecision | null {
  const weightKg = positive(input.weightKg);
  const lengthCm = positive(input.packageLengthCm);
  const widthCm = positive(input.packageWidthCm);
  const heightCm = positive(input.packageHeightCm);

  // On ne force aucun mode tant que les données transport ERP ne sont pas complètes.
  if (!weightKg || !lengthCm || !widthCm || !heightCm) return null;

  const maxDimensionCm = Math.max(lengthCm, widthCm, heightCm);

  // Règle métier ADEI validée : dimension maxi strictement inférieure à 3 m.
  if (maxDimensionCm < ADEI_TRIPOD_MESSAGERIE_MAX_DIMENSION_CM) {
    return { mode: "MESSAGERIE", reason: "UNDER_3M_MESSAGERIE" };
  }

  // À partir de 3 m, le tripode passe en affrètement avec coefficient C0.
  return {
    mode: "AFFRETEMENT",
    reason: "FROM_3M_AFFRETEMENT_C0",
    affretementCoefficient: 0,
  };
}
