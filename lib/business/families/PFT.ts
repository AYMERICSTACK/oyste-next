import type { BusinessFamilyDefinition } from "../types";
import { PFI_DEFINITION } from "./PFI";

export const PFT_DEFINITION: BusinessFamilyDefinition = {
  ...PFI_DEFINITION,
  id: "PFT",
  label: "Potence sur fût triangulée",
  shortLabel: "Potence sur fût triangulée",
  description:
    "Parcours de configuration pour une potence sur fût triangulée, avec les mêmes étapes que la potence sur fût inversée.",
};
