export type WallPotenceFamily = "PMI" | "PMT";

export type WallPotenceTechnicalWeight = {
  family: WallPotenceFamily;
  capacityKg: number;
  spanM: number;
  weightKg: number;
};

// Règle transport ADEI : seules les potences murales de portée 2 m,
// en capacités 150 / 250 / 500 / 1000 kg, sont éligibles à la messagerie.
// Les autres configurations passent directement en affrètement.
export const WALL_POTENCE_TECHNICAL_WEIGHTS: readonly WallPotenceTechnicalWeight[] = [
  { family: "PMI", capacityKg: 150, spanM: 2, weightKg: 73 },
  { family: "PMI", capacityKg: 250, spanM: 2, weightKg: 73 },
  { family: "PMI", capacityKg: 500, spanM: 2, weightKg: 73 },
  { family: "PMI", capacityKg: 1000, spanM: 2, weightKg: 124 },
  { family: "PMT", capacityKg: 150, spanM: 2, weightKg: 62 },
  { family: "PMT", capacityKg: 250, spanM: 2, weightKg: 62 },
  { family: "PMT", capacityKg: 500, spanM: 2, weightKg: 81 },
  { family: "PMT", capacityKg: 1000, spanM: 2, weightKg: 90 },
];

export function getWallPotenceTechnicalWeight(
  family: WallPotenceFamily,
  capacityKg: number,
  spanM: number,
) {
  return WALL_POTENCE_TECHNICAL_WEIGHTS.find(
    (row) =>
      row.family === family &&
      row.capacityKg === capacityKg &&
      Math.abs(row.spanM - spanM) < 0.001,
  )?.weightKg;
}
