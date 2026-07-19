import type { BusinessFamilyDefinition } from "../types";

export const PORT_DEFINITION: BusinessFamilyDefinition = {
  id: "PORT",
  label: "Portique",
  shortLabel: "Portique",
  description: "Définition métier à compléter pour les portiques.",
  searchStepIds: ["capacity", "span"],
  steps: [
    { id: "capacity", kind: "search", title: "Quelle charge souhaitez-vous lever ?", required: true },
    { id: "span", kind: "search", title: "Quelle ouverture souhaitez-vous ?", required: true },
  ],
  questionsToClarify: [
    "Valider si la portée, l'ouverture, la hauteur et la mobilité sont des critères de recherche ou des variantes.",
  ],
};
