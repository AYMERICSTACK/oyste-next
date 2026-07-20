import { AFFRETEMENT_PRICES, AFFRETEMENT_RULES } from "./shipping-data";
import { getDepartmentCode } from "./zones";

export function calculateAffretement(weightKg: number | undefined, postcode: string | undefined) {
  const department = getDepartmentCode(postcode);
  if (!department) return { amountHT: null, reason: "Code postal requis" };
  if (!weightKg || weightKg <= 0) return { amountHT: null, reason: "Poids à confirmer pour chiffrage définitif" };
  const rule = AFFRETEMENT_RULES.find((item) =>
    weightKg >= item.minWeightKg &&
    weightKg <= item.maxWeightKg &&
    (item.departments as readonly string[]).includes(department),
  );
  if (!rule) return { amountHT: null, reason: "Transport sur devis pour ce poids ou cette destination" };
  return {
    amountHT: AFFRETEMENT_PRICES[rule.zone]?.[rule.coefficient] ?? null,
    zone: rule.zone,
    coefficient: rule.coefficient,
    reason: `Zone ${rule.zone} · coefficient ${rule.coefficient}`,
  };
}
