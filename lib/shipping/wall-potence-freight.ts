import { calculateMessagerie } from "./messagerie";
import { PFI_FREIGHT_RATES } from "./pfi-freight-rates";
import type { WallPotenceFamily } from "./wall-potence-technical-data";
import { getWallPotenceTechnicalWeight } from "./wall-potence-technical-data";
import { getDepartmentCode } from "./zones";

export type WallPotenceFreightInput = {
  family: WallPotenceFamily;
  capacityKg: number;
  spanM: number;
  postcode?: string;
  quantity?: number;
  additionalWeightKg?: number;
  weightComplete?: boolean;
};

export type WallPotenceFreightResult = {
  mode: "messagerie" | "affretement" | "quote";
  amountHT: number | null;
  reason: string;
  weightKg?: number;
  department?: string;
  rateCode?: string;
  bracket?: string;
};

const MESSAGERIE_CAPACITIES = new Set([150, 250, 500, 1000]);

export function calculateWallPotenceFreight(
  input: WallPotenceFreightInput,
): WallPotenceFreightResult {
  const quantity = Math.max(1, input.quantity ?? 1);
  const department = getDepartmentCode(input.postcode);
  if (!department) {
    return { mode: "quote", amountHT: null, reason: "Code postal requis" };
  }

  const eligibleForMessagerie =
    input.spanM < 2.5 && MESSAGERIE_CAPACITIES.has(input.capacityKg);

  if (eligibleForMessagerie) {
    const unitWeightKg = getWallPotenceTechnicalWeight(
      input.family,
      input.capacityKg,
      input.spanM,
    );

    if (!unitWeightKg) {
      return {
        mode: "quote",
        amountHT: null,
        reason: `Poids technique ${input.family} indisponible`,
        department,
      };
    }

    if (input.weightComplete === false) {
      // Un poids d'option reste inconnu : bascule prudente en affrètement.
    } else {
      const result = calculateMessagerie(
        `${input.family}${input.capacityKg}${Math.round(input.spanM * 1000)}`,
        input.postcode,
        quantity,
        unitWeightKg + Math.max(0, input.additionalWeightKg ?? 0),
      );

      if (result?.amountHT !== null && result) {
        return {
          mode: "messagerie",
          amountHT: result.amountHT,
          reason: `Messagerie ${input.family} selon poids et destination`,
          weightKg: result.weightKg,
          department,
        };
      }
    }

    // Si le poids cumulé sort de la grille messagerie, la commande bascule
    // automatiquement sur l'affrètement de base du département.
  }

  const rate = PFI_FREIGHT_RATES.find(
    (item) =>
      item.department === department &&
      item.minCoefficient === 0 &&
      item.maxCoefficient === 0.99,
  );

  if (!rate) {
    return {
      mode: "quote",
      amountHT: null,
      reason: "Aucun tarif d’affrètement de base pour cette destination",
      department,
    };
  }

  return {
    mode: "affretement",
    amountHT: rate.priceHT * quantity,
    reason: `Affrètement ${input.family} département ${department}`,
    department,
    rateCode: rate.code,
    bracket: "0 à 0,99",
  };
}
