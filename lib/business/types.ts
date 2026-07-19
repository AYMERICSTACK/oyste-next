export type BusinessFamilyId = "PFI" | "PFT" | "PMI" | "PMT" | "PMA" | "PMAM" | "PORT" | "PALAN";

export type BusinessStepKind =
  | "search"
  | "exclusive-choice"
  | "boolean-option"
  | "option-group"
  | "automatic"
  | "sub-configurator";

export type BusinessAnswerValue = string | boolean | number | string[] | undefined;
export type BusinessAnswers = Record<string, BusinessAnswerValue>;

export type ComponentAction =
  | {
      type: "add";
      ref: string;
      quantity?: number;
      reason?: string;
    }
  | {
      type: "exclude";
      ref: string;
      reason?: string;
    }
  | {
      type: "replace";
      from: string;
      to: string;
      quantity?: number;
      reason?: string;
    };

export type BusinessChoice = {
  id: string;
  label: string;
  description?: string;
  recommended?: boolean;
  actions?: ComponentAction[];
  nextStepId?: string;
};

export type BusinessStepCondition = {
  answerId: string;
  equals?: BusinessAnswerValue;
  includes?: string;
  notEquals?: BusinessAnswerValue;
};

export type BusinessStep = {
  id: string;
  kind: BusinessStepKind;
  title: string;
  help?: string;
  required?: boolean;
  choices?: BusinessChoice[];
  actions?: ComponentAction[];
  showWhen?: BusinessStepCondition[];
  clientVisible?: boolean;
};

export type BusinessFamilyDefinition = {
  id: BusinessFamilyId;
  label: string;
  shortLabel: string;
  description: string;
  searchStepIds: string[];
  steps: BusinessStep[];
  defaultExclusions?: ComponentAction[];
  notes?: string[];
  questionsToClarify?: string[];
};

export type BusinessDecisionState = {
  familyId: BusinessFamilyId;
  answers: BusinessAnswers;
};

export type BusinessDecisionResult = {
  family: BusinessFamilyDefinition;
  visibleSteps: BusinessStep[];
  completedRequiredSteps: BusinessStep[];
  nextStep?: BusinessStep;
  actions: ComponentAction[];
  missingRequiredStepIds: string[];
};
