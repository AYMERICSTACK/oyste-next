export type PftTechnicalRow = {
  technicalCapacityKg: 150 | 250 | 500 | 1000 | 2000;
  spanM: number;
  standardHsfM: number;
  overallHeightM: number;
  dimensionAMm: number;
  dimensionCMm: number;
  standardBasePlateNumber: number;
  chemicalBasePlateCode: string | null;
  maxHsfM: number;
};

export const PFT_TECHNICAL_ROWS: readonly PftTechnicalRow[] = [
  { technicalCapacityKg: 150, spanM: 2, standardHsfM: 2.5, overallHeightM: 3.3, dimensionAMm: 210, dimensionCMm: 150, standardBasePlateNumber: 4, chemicalBasePlateCode: "SC04", maxHsfM: 9 },
  { technicalCapacityKg: 150, spanM: 3, standardHsfM: 2.5, overallHeightM: 3.3, dimensionAMm: 210, dimensionCMm: 150, standardBasePlateNumber: 4, chemicalBasePlateCode: "SC04", maxHsfM: 6 },
  { technicalCapacityKg: 150, spanM: 4, standardHsfM: 2.5, overallHeightM: 3.3, dimensionAMm: 210, dimensionCMm: 150, standardBasePlateNumber: 4, chemicalBasePlateCode: "SC06", maxHsfM: 4.5 },
  { technicalCapacityKg: 150, spanM: 5, standardHsfM: 2.5, overallHeightM: 3.3, dimensionAMm: 250, dimensionCMm: 150, standardBasePlateNumber: 4, chemicalBasePlateCode: "SC06", maxHsfM: 8.5 },
  { technicalCapacityKg: 150, spanM: 6, standardHsfM: 2.5, overallHeightM: 3.3, dimensionAMm: 250, dimensionCMm: 150, standardBasePlateNumber: 4, chemicalBasePlateCode: "SC08", maxHsfM: 7 },

  { technicalCapacityKg: 250, spanM: 2, standardHsfM: 2.5, overallHeightM: 3.3, dimensionAMm: 210, dimensionCMm: 150, standardBasePlateNumber: 4, chemicalBasePlateCode: "SC04", maxHsfM: 5.5 },
  { technicalCapacityKg: 250, spanM: 3, standardHsfM: 2.5, overallHeightM: 3.3, dimensionAMm: 210, dimensionCMm: 150, standardBasePlateNumber: 4, chemicalBasePlateCode: "SC06", maxHsfM: 4 },
  { technicalCapacityKg: 250, spanM: 4, standardHsfM: 2.5, overallHeightM: 3.3, dimensionAMm: 250, dimensionCMm: 150, standardBasePlateNumber: 4, chemicalBasePlateCode: "SC06", maxHsfM: 6 },
  { technicalCapacityKg: 250, spanM: 5, standardHsfM: 2.5, overallHeightM: 3.3, dimensionAMm: 250, dimensionCMm: 150, standardBasePlateNumber: 4, chemicalBasePlateCode: "SC08", maxHsfM: 5 },
  { technicalCapacityKg: 250, spanM: 6, standardHsfM: 2.5, overallHeightM: 3.3, dimensionAMm: 330, dimensionCMm: 150, standardBasePlateNumber: 5, chemicalBasePlateCode: "SC08", maxHsfM: 11 },

  { technicalCapacityKg: 500, spanM: 2, standardHsfM: 2.5, overallHeightM: 3.3, dimensionAMm: 250, dimensionCMm: 150, standardBasePlateNumber: 4, chemicalBasePlateCode: "SC06", maxHsfM: 6.5 },
  { technicalCapacityKg: 500, spanM: 3, standardHsfM: 2.5, overallHeightM: 3.3, dimensionAMm: 250, dimensionCMm: 150, standardBasePlateNumber: 4, chemicalBasePlateCode: "SC08", maxHsfM: 4 },
  { technicalCapacityKg: 500, spanM: 4, standardHsfM: 2.5, overallHeightM: 3.3, dimensionAMm: 330, dimensionCMm: 150, standardBasePlateNumber: 5, chemicalBasePlateCode: "SC08", maxHsfM: 8.5 },
  { technicalCapacityKg: 500, spanM: 5, standardHsfM: 2.5, overallHeightM: 3.3, dimensionAMm: 330, dimensionCMm: 150, standardBasePlateNumber: 5, chemicalBasePlateCode: "SC08", maxHsfM: 6.5 },
  { technicalCapacityKg: 500, spanM: 6, standardHsfM: 2.5, overallHeightM: 3.6, dimensionAMm: 380, dimensionCMm: 150, standardBasePlateNumber: 6, chemicalBasePlateCode: "SC10", maxHsfM: 8 },

  { technicalCapacityKg: 1000, spanM: 2, standardHsfM: 2.5, overallHeightM: 3.3, dimensionAMm: 330, dimensionCMm: 150, standardBasePlateNumber: 5, chemicalBasePlateCode: "SC08", maxHsfM: 9 },
  { technicalCapacityKg: 1000, spanM: 3, standardHsfM: 2.5, overallHeightM: 3.3, dimensionAMm: 330, dimensionCMm: 150, standardBasePlateNumber: 5, chemicalBasePlateCode: "SC10", maxHsfM: 5.5 },
  { technicalCapacityKg: 1000, spanM: 4, standardHsfM: 2.5, overallHeightM: 3.6, dimensionAMm: 380, dimensionCMm: 150, standardBasePlateNumber: 5, chemicalBasePlateCode: "SC10", maxHsfM: 6 },
  { technicalCapacityKg: 1000, spanM: 5, standardHsfM: 2.5, overallHeightM: 3.6, dimensionAMm: 420, dimensionCMm: 150, standardBasePlateNumber: 6, chemicalBasePlateCode: "SC12", maxHsfM: 7 },
  { technicalCapacityKg: 1000, spanM: 6, standardHsfM: 2.5, overallHeightM: 4, dimensionAMm: 420, dimensionCMm: 150, standardBasePlateNumber: 7, chemicalBasePlateCode: "SC15", maxHsfM: 6 },

  { technicalCapacityKg: 2000, spanM: 2, standardHsfM: 2.5, overallHeightM: 3.6, dimensionAMm: 420, dimensionCMm: 150, standardBasePlateNumber: 6, chemicalBasePlateCode: "SC10", maxHsfM: 9 },
  { technicalCapacityKg: 2000, spanM: 3, standardHsfM: 2.5, overallHeightM: 3.6, dimensionAMm: 420, dimensionCMm: 150, standardBasePlateNumber: 6, chemicalBasePlateCode: "SC15", maxHsfM: 6 },
  { technicalCapacityKg: 2000, spanM: 4, standardHsfM: 2.5, overallHeightM: 4, dimensionAMm: 420, dimensionCMm: 150, standardBasePlateNumber: 7, chemicalBasePlateCode: "SC15", maxHsfM: 4.5 },
  { technicalCapacityKg: 2000, spanM: 5, standardHsfM: 2.5, overallHeightM: 4, dimensionAMm: 510, dimensionCMm: 150, standardBasePlateNumber: 8, chemicalBasePlateCode: null, maxHsfM: 9 },
] as const;

export function getPftTechnicalRow(
  commercialCapacityKg: number,
  spanM: number,
): PftTechnicalRow | undefined {
  return PFT_TECHNICAL_ROWS.find(
    (row) =>
      row.technicalCapacityKg === commercialCapacityKg &&
      Math.abs(row.spanM - spanM) < 0.001,
  );
}
