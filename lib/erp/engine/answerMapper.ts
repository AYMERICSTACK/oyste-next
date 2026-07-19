import type { OuvrageSearchCriteria } from "../types";

export type OuvrageAnswers = Record<string, string | undefined>;

const POTENCE_FAMILY_BY_INSTALLATION_AND_CONCEPTION: Record<string, string> = {
  "fut:inversee": "PFI",
  "fut:triangulee": "PFT",
  "murale:inversee": "PMI",
  "murale:triangulee": "PMT",
};

const DIRECT_POTENCE_FAMILIES = new Set(["PFI", "PFT", "PMI", "PMT", "PMA", "PMAM"]);

const REACH_BY_ANSWER_ID: Record<string, number> = {
  "2m": 2000,
  "2-5m": 2500,
  "3m": 3000,
  "4m": 4000,
  "5m": 5000,
  "6m": 6000,
  "8m": 8000,
};

function getNumberFromAnswer(value?: string): number | undefined {
  if (!value) return undefined;
  const numeric = Number.parseInt(value, 10);
  return Number.isFinite(numeric) ? numeric : undefined;
}

function getReachFromAnswer(value?: string): number | undefined {
  if (!value) return undefined;
  return REACH_BY_ANSWER_ID[value] ?? getNumberFromAnswer(value);
}

export function getFamilyFromAnswers(answers: OuvrageAnswers): string | undefined {
  const directFamily = answers.family ?? answers.potenceType;

  if (directFamily && DIRECT_POTENCE_FAMILIES.has(directFamily)) {
    return directFamily;
  }

  if (!answers.installation || !answers.conception) return undefined;
  return POTENCE_FAMILY_BY_INSTALLATION_AND_CONCEPTION[`${answers.installation}:${answers.conception}`];
}

export function buildOuvrageCriteriaFromAnswers(answers: OuvrageAnswers): OuvrageSearchCriteria {
  return {
    family: getFamilyFromAnswers(answers),
    installation: answers.installation,
    conception: answers.conception,
    chargeKg: getNumberFromAnswer(answers.capacity),
    reachMm: getReachFromAnswer(answers.reach),
  };
}
