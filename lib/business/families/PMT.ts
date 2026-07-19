import type { BusinessFamilyDefinition } from "../types";
import { buildWallPotenceSteps } from "./wallPotenceSteps";

export const PMT_DEFINITION: BusinessFamilyDefinition = {
  id: "PMT",
  label: "Potence murale triangulée",
  shortLabel: "Potence murale triangulée",
  description:
    "Parcours de configuration pour une potence murale triangulée avec fixation sur mur béton ou poteau métallique.",
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
  steps: buildWallPotenceSteps("NOTEPM"),
  notes: [
    "La capacité et la portée identifient le modèle de base.",
    "Le client décrit son support ; le moteur sélectionne la fixation murale adaptée.",
  ],
};
