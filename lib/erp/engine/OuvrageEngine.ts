import { OuvrageRepository } from "../repositories";
import type { OuvrageInstallation, OuvrageSearchCriteria } from "../types";
import { buildOuvrageCriteriaFromAnswers, type OuvrageAnswers } from "./answerMapper";
import { getComponentsTotal, splitIncludedAndOptionalComponents } from "./pricing";

const FIELD_LABELS: Record<keyof OuvrageSearchCriteria, string> = {
  family: "type de solution",
  installation: "implantation",
  conception: "conception",
  chargeKg: "charge",
  reachMm: "portée",
  spanMm: "ouverture",
  heightMm: "hauteur",
  widthMm: "largeur",
};

function getMissingFields(criteria: OuvrageSearchCriteria) {
  const required: (keyof OuvrageSearchCriteria)[] = ["family", "chargeKg", "reachMm"];
  return required.filter((field) => criteria[field] === undefined).map((field) => FIELD_LABELS[field]);
}

function emptyInstallation(partial: Partial<OuvrageInstallation>): OuvrageInstallation {
  return {
    includedComponents: [],
    optionalComponents: [],
    missingFields: [],
    basePrice: 0,
    includedTotal: 0,
    optionalTotal: 0,
    total: 0,
    status: "waiting",
    ...partial,
  };
}

export class OuvrageEngine {
  constructor(private readonly ouvrages = new OuvrageRepository()) {}

  findByCriteria(criteria: OuvrageSearchCriteria): OuvrageInstallation {
    const familyCode = criteria.family;
    const expectedChargeKg = criteria.chargeKg;
    const expectedReachMm = criteria.reachMm;
    const missingFields = getMissingFields(criteria);

    if (!familyCode) {
      return emptyInstallation({ familyCode, expectedChargeKg, expectedReachMm, missingFields });
    }

    if (missingFields.length > 0) {
      return emptyInstallation({
        familyCode,
        expectedChargeKg,
        expectedReachMm,
        missingFields,
        status: "family-found",
      });
    }

    const match = this.ouvrages.findBest(criteria);

    if (!match) {
      return emptyInstallation({
        familyCode,
        expectedChargeKg,
        expectedReachMm,
        missingFields: [],
        status: "not-found",
      });
    }

    const { includedComponents, optionalComponents } = splitIncludedAndOptionalComponents(match.ouvrage.components);
    const mainComponent = includedComponents[0] ?? match.ouvrage.components[0];
    const includedTotal = getComponentsTotal(includedComponents);

    return {
      match,
      familyCode,
      expectedChargeKg,
      expectedReachMm,
      mainComponent,
      includedComponents,
      optionalComponents,
      missingFields: [],
      basePrice: mainComponent?.costPrice ?? match.ouvrage.basePrice ?? 0,
      includedTotal,
      optionalTotal: 0,
      total: includedTotal,
      status: "solution-found",
    };
  }

  findInstallation(answers: OuvrageAnswers): OuvrageInstallation {
    return this.findByCriteria(buildOuvrageCriteriaFromAnswers(answers));
  }
}

const defaultEngine = new OuvrageEngine();

export function buildOuvrageInstallation(answers: OuvrageAnswers): OuvrageInstallation {
  return defaultEngine.findInstallation(answers);
}
