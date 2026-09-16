import { PFI_FREIGHT_RATES } from "./pfi-freight-rates";
import { getPftTechnicalRow } from "./pft-technical-data";
import { getDepartmentCode } from "./zones";

export type PftFixing = "STANDARD" | "CHEMICAL";
export type PftFreightInput = {
  capacityKg: number;
  spanM: number;
  hsfM: number;
  fixing: PftFixing;
  postcode?: string;
};

export type PftFreightResult = {
  amountHT: number | null;
  reason: string;
  department?: string;
  coefficient?: number;
  rateCode?: string;
  bracket?: string;
  widthM?: number;
  mastLengthM?: number;
  jibLengthM?: number;
  greatestLengthM?: number;
};

function chemicalWidth(code: string | null) {
  const match = code?.match(/^SC(\d{2})$/i);
  return match ? Number(match[1]) / 10 : null;
}

export function calculatePftFreight(input: PftFreightInput): PftFreightResult {
  const department = getDepartmentCode(input.postcode);
  if (!department) return { amountHT: null, reason: "Code postal requis" };

  const row = getPftTechnicalRow(input.capacityKg, input.spanM);
  if (!row) {
    return {
      amountHT: null,
      reason: "Configuration PFT absente de la table technique",
    };
  }

  if (input.hsfM < row.standardHsfM - 0.001 || input.hsfM > row.maxHsfM + 0.001) {
    return {
      amountHT: null,
      reason: "Hauteur sous fer PFT hors limites techniques",
    };
  }

  const widthM =
    input.fixing === "STANDARD"
      ? row.standardBasePlateNumber / 10
      : chemicalWidth(row.chemicalBasePlateCode);

  if (!widthM) {
    return {
      amountHT: null,
      reason: "Semelle à cheviller indisponible pour cette configuration",
    };
  }

  const mastLengthM = input.hsfM + (row.overallHeightM - row.standardHsfM);
  const jibLengthM =
    input.spanM + row.dimensionCMm / 1000 + row.dimensionAMm / 2000;
  const greatestLengthM = Math.max(mastLengthM, jibLengthM);
  const coefficient = Number(((widthM * greatestLengthM) / 2).toFixed(6));

  const rate = PFI_FREIGHT_RATES.find(
    (item) =>
      item.department === department &&
      coefficient >= item.minCoefficient &&
      coefficient <= item.maxCoefficient,
  );

  if (!rate) {
    return {
      amountHT: null,
      reason:
        "Aucun tarif d’affrètement trouvé pour cette destination et ce coefficient",
      department,
      coefficient,
      widthM,
      mastLengthM,
      jibLengthM,
      greatestLengthM,
    };
  }

  return {
    amountHT: rate.priceHT,
    reason: `Affrètement PFT département ${department}`,
    department,
    coefficient,
    rateCode: rate.code,
    bracket: `${rate.minCoefficient} à ${rate.maxCoefficient}`,
    widthM,
    mastLengthM,
    jibLengthM,
    greatestLengthM,
  };
}
