import { PFI_FREIGHT_RATES } from "./pfi-freight-rates";
import { PFI_COMMERCIAL_TO_TECHNICAL_CAPACITY, PFI_TECHNICAL_ROWS } from "./pfi-technical-data";
import { getDepartmentCode } from "./zones";

export type PfiFixing = "STANDARD" | "CHEMICAL";
export type PfiFreightInput = { capacityKg: number; spanM: number; hsfM: number; fixing: PfiFixing; postcode?: string };
export type PfiFreightResult = {
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

export function calculatePfiFreight(input: PfiFreightInput): PfiFreightResult {
  const department = getDepartmentCode(input.postcode);
  if (!department) return { amountHT: null, reason: "Code postal requis" };
  const technicalCapacity = PFI_COMMERCIAL_TO_TECHNICAL_CAPACITY[input.capacityKg];
  if (!technicalCapacity) return { amountHT: null, reason: "Charge PFI non prise en charge automatiquement" };
  const row = PFI_TECHNICAL_ROWS.find((item) => item.technicalCapacityKg === technicalCapacity && Math.abs(item.spanM - input.spanM) < 0.001);
  if (!row) return { amountHT: null, reason: "Configuration PFI absente de la table technique" };
  const widthM = input.fixing === "STANDARD" ? row.standardBasePlateNumber / 10 : chemicalWidth(row.chemicalBasePlateCode);
  if (!widthM) return { amountHT: null, reason: "Semelle à cheviller indisponible pour cette configuration" };
  const mastLengthM = input.hsfM + (row.overallHeightM - row.standardHsfM);
  const jibLengthM = input.spanM + row.dimensionCMm / 1000 + row.dimensionAMm / 2000;
  const greatestLengthM = Math.max(mastLengthM, jibLengthM);
  const coefficient = Number((widthM * greatestLengthM / 2).toFixed(6));
  const rate = PFI_FREIGHT_RATES.find((item) => item.department === department && coefficient >= item.minCoefficient && coefficient <= item.maxCoefficient);
  if (!rate) return { amountHT: null, reason: "Aucun tarif d’affrètement trouvé pour cette destination et ce coefficient", department, coefficient, widthM, mastLengthM, jibLengthM, greatestLengthM };
  return { amountHT: rate.priceHT, reason: `Affrètement PFI département ${department}`, department, coefficient, rateCode: rate.code, bracket: `${rate.minCoefficient} à ${rate.maxCoefficient}`, widthM, mastLengthM, jibLengthM, greatestLengthM };
}
