import type { BusinessFamilyDefinition } from "../types";

export const PMAM_DEFINITION: BusinessFamilyDefinition = {
  id: "PMAM",
  label: "Potence murale articulée motorisée",
  shortLabel: "Potence articulée motorisée",
  description: "Parcours de configuration pour une potence murale articulée motorisée.",
  searchStepIds: ["capacity", "reach"],
  steps: [
    {
      id: "capacity",
      kind: "search",
      title: "Quelle charge souhaitez-vous lever ?",
      required: true,
      help: "Indiquez la charge maximale à lever pour dimensionner la solution motorisée.",
    },
    {
      id: "reach",
      kind: "search",
      title: "Quelle portée souhaitez-vous couvrir ?",
      required: true,
      help: "La portée correspond au rayon de travail nécessaire autour de votre poste.",
    },
  ],
  questionsToClarify: ["Compléter les options spécifiques PMAM."],
};
