import type { BusinessDecisionResult } from "@/lib/business";
import type { ErpComponent, OuvrageInstallation } from "@/lib/erp/types";
import type { ComponentType } from "react";

export type IconComponent = ComponentType<{
  size?: number;
  strokeWidth?: number;
  className?: string;
}>;

export type AnswerValue = string | string[] | undefined;
export type Answers = Record<string, AnswerValue>;

export type ConfiguratorChoice = {
  id: string;
  label: string;
  description: string;
  priceImpact?: number;
  recommended?: boolean;
};

export type ConfiguratorQuestionKind =
  | "search"
  | "exclusive-choice"
  | "boolean-option"
  | "option-group"
  | "automatic"
  | "sub-configurator";

export type ConfiguratorQuestion = {
  id: string;
  title: string;
  eyebrow: string;
  description: string;
  icon: IconComponent;
  choices: ConfiguratorChoice[];
  kind?: ConfiguratorQuestionKind;
  required?: boolean;
  multiple?: boolean;
};

export type ProductVariant = {
  id: string;
  familyCode: "PFI" | "PFT" | "PMI" | "PMT" | "PMA" | "PMAM";
  label: string;
  reference: string;
  installation: "fut" | "murale";
  conception: "inversee" | "triangulee";
  capacity: string;
  reach: string;
  fixing: string[];
  environment: string[];
  price: number;
};

export type Accessory = {
  id: string;
  label: string;
  description: string;
  price: number;
  icon: IconComponent;
  required?: boolean;
  recommended?: boolean;
  compatibleCapacity?: string[];
  compatibleReach?: string[];
  compatibleFixing?: string[];
  compatibleEnvironment?: string[];
};

export type SummaryLine = {
  id: string;
  label: string;
  value: string;
  priceImpact?: number;
  type: "answer" | "rule" | "product" | "accessory" | "business";
};

export type EngineWarning = {
  id: string;
  title: string;
  message: string;
  tone: "info" | "warning" | "success";
};

export type ConfiguratorComponentLine = {
  id: string;
  label: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
};

export type ConfiguratorPriceBreakdown = {
  solutionTotal: number;
  hoistTotal: number;
  complementsTotal: number;
  totalHt: number;
};


export type HoistDetailNote = {
  label: string;
  value: string;
  description?: string;
};

export type HoistDetail = {
  mode: "manual" | "electric";
  familyPrefix: string;
  reference?: string;
  title: string;
  subtitle: string;
  capacityKg: number;
  liftingHeightM: number;
  commandLabel?: string;
  trolleyMovementLabel?: string;
  chainBucketLabel?: string;
  controlCableLengthM?: number;
  componentLines: ConfiguratorComponentLine[];
  notes: HoistDetailNote[];
  totalHt: number;
};

export type ConfiguratorInstallationSummary = {
  status: "waiting" | "in-progress" | "ready" | "alternative" | "needs-review";
  eyebrow: string;
  title: string;
  subtitle: string;
  badge: string;
  canAddToCart: boolean;
  includedComponentsCount: number;
  optionalComponentsCount: number;
  includedPreview: ErpComponent[];
  visibleComponents: ConfiguratorComponentLine[];
  hiddenComponentsCount: number;
};

export type EngineResult = {
  answers: Answers;
  questions: ConfiguratorQuestion[];
  currentQuestion: ConfiguratorQuestion;
  selectedChoices: ConfiguratorChoice[];
  selectedVariant?: ProductVariant;
  erpInstallation: OuvrageInstallation;
  installationSummary: ConfiguratorInstallationSummary;
  businessDecision?: BusinessDecisionResult;
  businessFamilyLabel?: string;
  compatibleAccessories: Accessory[];
  requiredAccessories: Accessory[];
  selectedAccessories: Accessory[];
  summaryLines: SummaryLine[];
  warnings: EngineWarning[];
  basePrice: number;
  optionsTotal: number;
  accessoriesTotal: number;
  hoistDetail?: HoistDetail;
  priceBreakdown: ConfiguratorPriceBreakdown;
  total: number;
  progress: number;
};
