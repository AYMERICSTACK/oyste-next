import type { BusinessFamilyDefinition } from "../types";

export const PMA_DEFINITION: BusinessFamilyDefinition = {
  id: "PMA",
  label: "Potence murale articulée",
  shortLabel: "Potence articulée",
  description: "Parcours de configuration pour une potence murale articulée.",
  searchStepIds: ["capacity", "reach"],
  steps: [
    {
      id: "capacity",
      kind: "search",
      title: "Quelle charge souhaitez-vous lever ?",
      required: true,
      help: "Indiquez la charge maximale à lever pour dimensionner la potence articulée.",
    },
    {
      id: "reach",
      kind: "search",
      title: "Quelle portée souhaitez-vous couvrir ?",
      required: true,
      help: "La portée correspond au rayon de travail nécessaire autour de votre poste.",
    },
  ],
  questionsToClarify: ["Compléter les options spécifiques PMA."],
};
