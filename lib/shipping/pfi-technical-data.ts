export type PfiTechnicalRow = {
  technicalCapacityKg: 125 | 250 | 500 | 1000 | 2000;
  spanM: number;
  standardHsfM: number;
  overallHeightM: number;
  dimensionAMm: number;
  dimensionCMm: number;
  standardBasePlateNumber: number;
  chemicalBasePlateCode: string | null;
  maxHsfM: number;
};

export const PFI_COMMERCIAL_TO_TECHNICAL_CAPACITY: Readonly<Record<number, PfiTechnicalRow["technicalCapacityKg"]>> = {
  150: 125,
  250: 250,
  500: 500,
  1000: 1000,
  2000: 2000,
};

export const PFI_TECHNICAL_ROWS: readonly PfiTechnicalRow[] = [
  { technicalCapacityKg: 125, spanM: 2, standardHsfM: 3, overallHeightM: 3.26, dimensionAMm: 210, dimensionCMm: 150, standardBasePlateNumber: 4, chemicalBasePlateCode: "SC04", maxHsfM: 8.5 },
  { technicalCapacityKg: 125, spanM: 3, standardHsfM: 3, overallHeightM: 3.26, dimensionAMm: 210, dimensionCMm: 150, standardBasePlateNumber: 4, chemicalBasePlateCode: "SC04", maxHsfM: 5 },
  { technicalCapacityKg: 125, spanM: 4, standardHsfM: 3, overallHeightM: 3.26, dimensionAMm: 250, dimensionCMm: 150, standardBasePlateNumber: 4, chemicalBasePlateCode: "SC06", maxHsfM: 7.5 },
  { technicalCapacityKg: 125, spanM: 5, standardHsfM: 3, overallHeightM: 3.28, dimensionAMm: 250, dimensionCMm: 150, standardBasePlateNumber: 4, chemicalBasePlateCode: "SC06", maxHsfM: 6 },
  { technicalCapacityKg: 125, spanM: 6, standardHsfM: 3, overallHeightM: 3.32, dimensionAMm: 330, dimensionCMm: 150, standardBasePlateNumber: 5, chemicalBasePlateCode: "SC08", maxHsfM: 11 },
  { technicalCapacityKg: 250, spanM: 2, standardHsfM: 3, overallHeightM: 3.26, dimensionAMm: 210, dimensionCMm: 150, standardBasePlateNumber: 4, chemicalBasePlateCode: "SC04", maxHsfM: 4.5 },
  { technicalCapacityKg: 250, spanM: 3, standardHsfM: 3, overallHeightM: 3.26, dimensionAMm: 250, dimensionCMm: 150, standardBasePlateNumber: 4, chemicalBasePlateCode: "SC06", maxHsfM: 6 },
  { technicalCapacityKg: 250, spanM: 4, standardHsfM: 3, overallHeightM: 3.26, dimensionAMm: 250, dimensionCMm: 150, standardBasePlateNumber: 4, chemicalBasePlateCode: "SC08", maxHsfM: 5 },
  { technicalCapacityKg: 250, spanM: 5, standardHsfM: 3, overallHeightM: 3.32, dimensionAMm: 330, dimensionCMm: 150, standardBasePlateNumber: 5, chemicalBasePlateCode: "SC08", maxHsfM: 11 },
  { technicalCapacityKg: 250, spanM: 6, standardHsfM: 3, overallHeightM: 3.32, dimensionAMm: 330, dimensionCMm: 150, standardBasePlateNumber: 5, chemicalBasePlateCode: "SC08", maxHsfM: 8 },
  { technicalCapacityKg: 500, spanM: 2, standardHsfM: 3, overallHeightM: 3.26, dimensionAMm: 250, dimensionCMm: 150, standardBasePlateNumber: 4, chemicalBasePlateCode: "SC06", maxHsfM: 4.5 },
  { technicalCapacityKg: 500, spanM: 3, standardHsfM: 3, overallHeightM: 3.32, dimensionAMm: 330, dimensionCMm: 150, standardBasePlateNumber: 5, chemicalBasePlateCode: "SC08", maxHsfM: 10.5 },
  { technicalCapacityKg: 500, spanM: 4, standardHsfM: 3, overallHeightM: 3.32, dimensionAMm: 330, dimensionCMm: 150, standardBasePlateNumber: 5, chemicalBasePlateCode: "SC08", maxHsfM: 6 },
  { technicalCapacityKg: 500, spanM: 5, standardHsfM: 3, overallHeightM: 3.38, dimensionAMm: 380, dimensionCMm: 150, standardBasePlateNumber: 6, chemicalBasePlateCode: "SC08", maxHsfM: 7.5 },
  { technicalCapacityKg: 500, spanM: 6, standardHsfM: 3, overallHeightM: 3.38, dimensionAMm: 380, dimensionCMm: 150, standardBasePlateNumber: 6, chemicalBasePlateCode: "SC10", maxHsfM: 4 },
  { technicalCapacityKg: 1000, spanM: 2, standardHsfM: 3, overallHeightM: 3.32, dimensionAMm: 330, dimensionCMm: 150, standardBasePlateNumber: 5, chemicalBasePlateCode: "SC08", maxHsfM: 8 },
  { technicalCapacityKg: 1000, spanM: 3, standardHsfM: 3, overallHeightM: 3.38, dimensionAMm: 380, dimensionCMm: 150, standardBasePlateNumber: 6, chemicalBasePlateCode: "SC10", maxHsfM: 7 },
  { technicalCapacityKg: 1000, spanM: 4, standardHsfM: 3, overallHeightM: 3.38, dimensionAMm: 380, dimensionCMm: 150, standardBasePlateNumber: 6, chemicalBasePlateCode: "SC10", maxHsfM: 4 },
  { technicalCapacityKg: 1000, spanM: 5, standardHsfM: 3, overallHeightM: 3.44, dimensionAMm: 420, dimensionCMm: 150, standardBasePlateNumber: 7, chemicalBasePlateCode: "SC12", maxHsfM: 5.5 },
  { technicalCapacityKg: 1000, spanM: 6, standardHsfM: 3, overallHeightM: 3.44, dimensionAMm: 510, dimensionCMm: 150, standardBasePlateNumber: 7, chemicalBasePlateCode: "SC15", maxHsfM: 10 },
  { technicalCapacityKg: 2000, spanM: 2, standardHsfM: 3, overallHeightM: 3.38, dimensionAMm: 380, dimensionCMm: 150, standardBasePlateNumber: 6, chemicalBasePlateCode: "SC10", maxHsfM: 5 },
  { technicalCapacityKg: 2000, spanM: 3, standardHsfM: 3, overallHeightM: 3.38, dimensionAMm: 420, dimensionCMm: 150, standardBasePlateNumber: 7, chemicalBasePlateCode: "SC15", maxHsfM: 4 },
  { technicalCapacityKg: 2000, spanM: 4, standardHsfM: 3, overallHeightM: 3.44, dimensionAMm: 510, dimensionCMm: 150, standardBasePlateNumber: 7, chemicalBasePlateCode: "SC15", maxHsfM: 8 },
  { technicalCapacityKg: 2000, spanM: 5, standardHsfM: 3, overallHeightM: 3.55, dimensionAMm: 510, dimensionCMm: 150, standardBasePlateNumber: 8, chemicalBasePlateCode: null, maxHsfM: 7.5 },
] as const;

export function getPfiTechnicalRow(
  commercialCapacityKg: number,
  spanM: number,
): PfiTechnicalRow | undefined {
  const technicalCapacityKg =
    PFI_COMMERCIAL_TO_TECHNICAL_CAPACITY[commercialCapacityKg];

  if (!technicalCapacityKg) return undefined;

  return PFI_TECHNICAL_ROWS.find(
    (row) =>
      row.technicalCapacityKg === technicalCapacityKg &&
      Math.abs(row.spanM - spanM) < 0.001,
  );
}
