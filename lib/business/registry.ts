import {
  PFI_DEFINITION,
  PFT_DEFINITION,
  PMI_DEFINITION,
  PMT_DEFINITION,
  PMA_DEFINITION,
  PMAM_DEFINITION,
  PORT_DEFINITION,
} from "./families";
import type { BusinessFamilyDefinition, BusinessFamilyId } from "./types";

export const businessFamilies: BusinessFamilyDefinition[] = [
  PFI_DEFINITION,
  PFT_DEFINITION,
  PMI_DEFINITION,
  PMT_DEFINITION,
  PMA_DEFINITION,
  PMAM_DEFINITION,
  PORT_DEFINITION,
];

export const businessFamilyRegistry = new Map<BusinessFamilyId, BusinessFamilyDefinition>(
  businessFamilies.map((family) => [family.id, family])
);

export function getBusinessFamily(familyId: BusinessFamilyId) {
  const family = businessFamilyRegistry.get(familyId);

  if (!family) {
    throw new Error(`Famille métier inconnue: ${familyId}`);
  }

  return family;
}
