import type { BusinessFamilyDefinition } from "../types";
import { buildWallPotenceSteps } from "./wallPotenceSteps";

export const PMI_DEFINITION: BusinessFamilyDefinition = {
  id: "PMI",
  label: "Potence murale inversée",
  shortLabel: "Potence murale inversée",
  description:
    "Parcours de configuration pour une potence murale inversée avec fixation sur mur béton, poteau métallique ou poteau béton.",
  searchStepIds: ["capacity", "reach"],
  defaultExclusions: [
    {
      type: "exclude",
      ref: "BUTSOUD",
      reason: "Les butées de rotation à souder ne sont plus proposées.",
    },
    {
      type: "exclude",
      ref: "ER2_EQ_HARTING",
      reason: "Composant réservé aux préparations internes.",
    },
  ],
  steps: buildWallPotenceSteps({
    noteRef: "NOTEPM",
    includeUnderBeamHeight: false,
  }),
  notes: [
    "La capacité et la portée identifient le modèle de base.",
    "Le client décrit son support ; le moteur sélectionne la fixation murale adaptée.",
  ],
};
