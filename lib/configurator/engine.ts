import {
  BadgeCheck,
  Building2,
  CheckSquare,
  Factory,
  PackagePlus,
  PlugZap,
  Ruler,
  Settings2,
  TowerControl,
  Weight,
} from "lucide-react";
import { businessDecisionEngine, getBusinessFamily } from "@/lib/business";
import type {
  BusinessAnswerValue,
  BusinessChoice,
  BusinessStep,
  ComponentAction,
} from "@/lib/business";
import {
  buildOuvrageInstallation,
  findErpProduct,
  getComponentLineTotal,
  getIncludedQuantity,
  roundPrice,
} from "@/lib/erp";
import { getCompatibleAccessories } from "./compatibility";
import { getPfiTechnicalRow } from "@/lib/shipping/pfi-technical-data";
import { getPftTechnicalRow } from "@/lib/shipping/pft-technical-data";
import { calculateSellingPrice } from "./pricing";
import { getHoistBusinessActions, getHoistDetail, getSelectedHoistInfo } from "./hoist";
import { productVariants } from "./products";
import { configuratorQuestions } from "./questions";
import { getRuleSummaryLines, getRuleWarnings } from "./rules";
import type {
  Answers,
  ConfiguratorChoice,
  ConfiguratorComponentLine,
  ConfiguratorInstallationSummary,
  ConfiguratorQuestion,
  EngineResult,
  ProductVariant,
  SummaryLine,
} from "./types";

type PotenceFamilyId = "PFI" | "PFT" | "PMI" | "PMT" | "PMA" | "PMAM";

const DEFAULT_FAMILY_ID: PotenceFamilyId = "PFI";

const POTENCE_TYPE_CHOICES: ConfiguratorChoice[] = [
  {
    id: "PFI",
    label: "Potence sur fût inversée",
    description: "Solution autoportante fixée au sol, adaptée lorsqu’aucun support mural n’est disponible.",
    recommended: true,
  },
  {
    id: "PFT",
    label: "Potence sur fût triangulée",
    description: "Solution autoportante avec structure triangulée pour les configurations nécessitant plus de rigidité.",
  },
  {
    id: "PMI",
    label: "Potence murale inversée",
    description: "Solution fixée sur un mur ou un poteau existant afin de libérer l’espace au sol.",
  },
  {
    id: "PMT",
    label: "Potence murale triangulée",
    description: "Solution murale renforcée pour couvrir une zone de travail avec une structure existante adaptée.",
  },
  {
    id: "PMA",
    label: "Potence murale articulée",
    description: "Solution articulée pour contourner des obstacles et couvrir plusieurs zones autour du poste.",
  },
  {
    id: "PMAM",
    label: "Potence murale articulée motorisée",
    description: "Version articulée motorisée pour améliorer le confort d’utilisation sur les postes exigeants.",
  },
];

const POTENCE_TYPE_QUESTION: ConfiguratorQuestion = {
  id: "potenceType",
  eyebrow: "Type",
  title: "Quel type de potence souhaitez-vous configurer ?",
  description:
    "Choisissez la famille de potence qui correspond le mieux à votre environnement de travail. Les étapes suivantes seront adaptées à ce choix.",
  icon: BadgeCheck,
  choices: POTENCE_TYPE_CHOICES,
  kind: "exclusive-choice",
  required: true,
};

const CAPACITY_CHOICES: ConfiguratorChoice[] = [
  {
    id: "150",
    label: "Jusqu’à 150 kg",
    description: "Idéal pour les petites charges manipulées régulièrement sur un poste de travail.",
  },
  {
    id: "250",
    label: "Jusqu’à 250 kg",
    description: "Adapté aux opérations courantes en atelier, maintenance ou production.",
  },
  {
    id: "500",
    label: "Jusqu’à 500 kg",
    description:
      "Pour les pièces plus lourdes nécessitant une solution de levage plus robuste.",
  },
  {
    id: "1000",
    label: "Jusqu’à 1 tonne",
    description: "Pour les charges importantes et les postes utilisés de manière intensive.",
  },
  {
    id: "2000",
    label: "Jusqu’à 2 tonnes",
    description: "Pour les charges très lourdes nécessitant une installation renforcée.",
  },
];

const REACH_CHOICES: ConfiguratorChoice[] = [
  {
    id: "2m",
    label: "2 m",
    description: "Pour travailler au plus près de la colonne et limiter l’encombrement.",
  },
  {
    id: "3m",
    label: "3 m",
    description: "Pour couvrir confortablement un poste de travail standard.",
  },
  {
    id: "4m",
    label: "4 m",
    description: "Pour atteindre une zone plus large autour de la colonne.",
  },
  {
    id: "5m",
    label: "5 m",
    description: "Pour couvrir une grande zone de travail lorsque l’environnement le permet.",
  },
  {
    id: "6m",
    label: "6 m",
    description: "Pour les grandes zones de manutention et les postes avec plus de recul.",
  },
];

const GENERIC_UNDER_BEAM_HEIGHT_CHOICES: ConfiguratorChoice[] = [
  {
    id: "3m",
    label: "3 m",
    description: "Convient à la majorité des postes de travail en atelier.",
  },
  {
    id: "4m",
    label: "4 m",
    description: "Apporte davantage d’espace sous la poutre pour les charges et les accessoires.",
  },
  {
    id: "5m",
    label: "5 m",
    description: "Pour les installations nécessitant plus de dégagement vertical.",
  },
  {
    id: "custom",
    label: "Autre hauteur",
    description: "Sélectionnez cette option si votre hauteur ne correspond pas aux choix proposés.",
  },
];

function parseMetersChoice(value: BusinessAnswerValue): number | undefined {
  if (typeof value !== "string") return undefined;

  const parsed = Number.parseFloat(
    value.replace(",", ".").replace(/[^0-9.]/g, ""),
  );

  return Number.isFinite(parsed) ? parsed : undefined;
}

function getSelectedTechnicalRow(answers: Answers) {
  const capacityKg = Number.parseInt(asString(answers.capacity) ?? "", 10);
  const spanM = parseMetersChoice(answers.reach);
  const family = getSelectedPotenceFamilyId(answers);

  if (!Number.isFinite(capacityKg) || !spanM) return undefined;
  if (family === "PFI") return getPfiTechnicalRow(capacityKg, spanM);
  if (family === "PFT") return getPftTechnicalRow(capacityKg, spanM);
  return undefined;
}

function buildDynamicUnderBeamHeightChoices(
  answers: Answers,
): ConfiguratorChoice[] {
  const family = getSelectedPotenceFamilyId(answers);
  const row = getSelectedTechnicalRow(answers);

  if (!row) {
    const standardHsfM = family === "PFT" ? 2.5 : 3;
    return [
      {
        id: `${standardHsfM.toFixed(1)}m`,
        label: `${standardHsfM.toFixed(1).replace(".", ",")} m`,
        description: `Hauteur sous fer standard de la gamme ${family ?? "sélectionnée"}.`,
      },
    ];
  }

  const stepCount = Math.round(
    (row.maxHsfM - row.standardHsfM) * 10,
  );

  return Array.from({ length: stepCount + 1 }, (_, index) => {
    const heightM = Number(
      (row.standardHsfM + index / 10).toFixed(1),
    );
    const isStandard = index === 0;

    return {
      id: `${heightM.toFixed(1)}m`,
      label: `${heightM.toFixed(1).replace(".", ",")} m`,
      description: isStandard
        ? "Hauteur sous fer standard, sans supplément."
        : `${index} supplément${index > 1 ? "s" : ""} de 10 cm appliqué${index > 1 ? "s" : ""} automatiquement.`,
      recommended: isStandard,
    };
  });
}

const LIFTING_HEIGHT_CHOICES: ConfiguratorChoice[] = Array.from(
  { length: 13 },
  (_, index) => {
    const meters = index + 3;
    return {
      id: `${meters}m`,
      label: `${meters} m`,
      description:
        meters <= 6
          ? "Le palan est préparé avec le bac à chaîne standard correspondant."
          : "Un bac à chaîne grande capacité est sélectionné automatiquement.",
    };
  },
);

const MANUAL_TROLLEY_CHOICES: ConfiguratorChoice[] = [
  { id: "push", label: "Par poussée", description: "Chariot manuel HTP en largeur standard, déplacé directement par l’opérateur." },
  { id: "chain", label: "Par chaîne", description: "Chariot manuel HTG en largeur standard, commandé par chaîne de manœuvre." },
];

const ELECTRIC_TROLLEY_CHOICES: ConfiguratorChoice[] = [
  { id: "push", label: "Par poussée", description: "Chariot manuel standard. Le raccordement à la ligne d’alimentation reste à la charge du client." },
  { id: "motorized", label: "Motorisé", description: "Chariot motorisé standard avec butées et fins de course obligatoires." },
];

const ELECTRIC_HOIST_OPTIONS: ConfiguratorChoice[] = [
  { id: "stainless-hook", label: "Crochet bas inox", description: "Crochet bas inox ajouté au palan électrique." },
];

const STEP_EYEBROWS: Record<string, string> = {
  potenceType: "Type",
  capacity: "Charge",
  reach: "Portée",
  fixing: "Fixation",
  wallSupport: "Support",
  postFixing: "Fixation",
  postWidth: "Largeur",
  underBeamHeight: "Hauteur",
  mechanicalOptions: "Options mécaniques",
  electricalOptions: "Options électriques",
  environment: "Environnement",
  outsideOptions: "Options extérieures",
  calculationNote: "Documents",
  hoist: "Palan",
  hoistType: "Type de palan",
  liftingHeight: "Levage",
  hoistTrolleyMovement: "Chariot",
  hoistCommand: "Commande",
  hoistOptions: "Options du palan",
};

const STEP_ICONS: Record<string, ConfiguratorQuestion["icon"]> = {
  potenceType: BadgeCheck,
  capacity: Weight,
  reach: Ruler,
  fixing: Building2,
  wallSupport: Building2,
  postFixing: Building2,
  postWidth: Ruler,
  underBeamHeight: TowerControl,
  mechanicalOptions: Settings2,
  electricalOptions: PlugZap,
  environment: Factory,
  outsideOptions: Factory,
  calculationNote: CheckSquare,
  hoist: PackagePlus,
  hoistType: PackagePlus,
  liftingHeight: Ruler,
  hoistTrolleyMovement: Settings2,
  hoistCommand: PlugZap,
  hoistOptions: Settings2,
};

function asString(value: BusinessAnswerValue): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function getAvailableOuvrageComponents(answers: Answers) {
  const installation = buildOuvrageInstallation(
    normalizeAnswersForOuvrage(answers),
  );

  return [
    ...installation.optionalComponents,
    ...installation.includedComponents,
  ];
}

function findComponentByPrefix(answers: Answers, prefixes: string[]) {
  return getAvailableOuvrageComponents(answers).find((component) =>
    prefixes.some((prefix) =>
      component.code.toUpperCase().startsWith(prefix.toUpperCase()),
    ),
  );
}

function findWallFixingComponent(answers: Answers) {
  const components = getAvailableOuvrageComponents(answers);

  if (answers.wallSupport === "concrete-wall") {
    return components.find((component) =>
      component.code.toUpperCase().startsWith("FCM"),
    );
  }

  if (answers.wallSupport !== "metal-post") return undefined;

  const width = asString(answers.postWidth);
  const fixing = asString(answers.postFixing);

  if (!width || !fixing) return undefined;

  const expectedSuffix = fixing === "clamp" ? "CL" : "CE";

  return components.find((component) => {
    const code = component.code.toUpperCase();
    return code.startsWith("KF") && code.includes(width) && code.endsWith(expectedSuffix);
  });
}

function buildPfiFixingChoices(answers: Answers): ConfiguratorChoice[] {
  const gabarit = findComponentByPrefix(answers, ["GAB"]);
  const semelle = findComponentByPrefix(answers, ["SC"]);

  const choices: ConfiguratorChoice[] = [
    {
      id: "gabarit-ancrage",
      label: "Gabarit et tiges d'ancrage",
      description:
        gabarit?.label ??
        "Semelle standard obligatoire pour cette configuration.",
      recommended: true,
    },
  ];

  if (semelle) {
    choices.push({
      id: "semelle-cheviller",
      label: "Semelle à cheviller sur dalle béton",
      description: semelle.label,
    });
  }

  return choices;
}

function getBusinessChoices(
  step: BusinessStep,
  answers: Answers,
): ConfiguratorChoice[] {
  if (step.id === "capacity") return CAPACITY_CHOICES;
  if (step.id === "reach") return REACH_CHOICES;
  if (step.id === "fixing") return buildPfiFixingChoices(answers);
  if (step.id === "underBeamHeight") {
    return ["PFI", "PFT"].includes(getSelectedPotenceFamilyId(answers) ?? "")
      ? buildDynamicUnderBeamHeightChoices(answers)
      : GENERIC_UNDER_BEAM_HEIGHT_CHOICES;
  }
  if (step.id === "liftingHeight") return LIFTING_HEIGHT_CHOICES;
  if (step.id === "hoistTrolleyMovement") {
    return answers.hoistType === "manual" ? MANUAL_TROLLEY_CHOICES : ELECTRIC_TROLLEY_CHOICES;
  }
  if (step.id === "hoistOptions") return ELECTRIC_HOIST_OPTIONS;

  return (step.choices ?? []).map((choice: BusinessChoice) => ({
    id: choice.id,
    label: choice.label,
    description:
      choice.description ??
      "Choix guidé selon le besoin de votre installation.",
    recommended: choice.recommended,
  }));
}

function businessStepToQuestion(
  step: BusinessStep,
  answers: Answers,
): ConfiguratorQuestion {
  const isOptionGroup = step.kind === "option-group";

  return {
    id: step.id,
    title: step.title,
    eyebrow: STEP_EYEBROWS[step.id] ?? "Configuration",
    description:
      step.help ??
      (isOptionGroup
        ? "Vous pouvez sélectionner une ou plusieurs options selon votre usage."
        : "Choisissez la réponse la plus proche de votre besoin."),
    icon: STEP_ICONS[step.id] ?? Settings2,
    choices: getBusinessChoices(step, answers),
    kind: step.kind,
    required: step.required,
    multiple: isOptionGroup,
  };
}

function getSelectedPotenceFamilyId(answers: Answers): PotenceFamilyId | undefined {
  const value = asString(answers.potenceType);
  return POTENCE_TYPE_CHOICES.some((choice) => choice.id === value)
    ? (value as PotenceFamilyId)
    : undefined;
}

function getActiveFamilyId(answers: Answers): PotenceFamilyId {
  return getSelectedPotenceFamilyId(answers) ?? DEFAULT_FAMILY_ID;
}

function getBusinessQuestions(answers: Answers): ConfiguratorQuestion[] {
  const selectedFamilyId = getSelectedPotenceFamilyId(answers);

  if (!selectedFamilyId) {
    return [POTENCE_TYPE_QUESTION];
  }

  const family = getBusinessFamily(selectedFamilyId);
  const result = businessDecisionEngine.evaluateFamily(family, answers);
  const familyQuestions = result.visibleSteps
    .map((step) => businessStepToQuestion(step, answers))
    .filter((step) => step.choices.length > 0);

  return [POTENCE_TYPE_QUESTION, ...familyQuestions];
}

function normalizeAnswersForOuvrage(answers: Answers) {
  const potenceType = getSelectedPotenceFamilyId(answers);

  return {
    family: potenceType,
    potenceType,
    installation: undefined,
    conception: undefined,
    capacity: asString(answers.capacity),
    reach: asString(answers.reach),
  };
}

function getSelectedChoices(
  questions: ConfiguratorQuestion[],
  answers: Answers,
) {
  return questions.flatMap((question) => {
    const answer = answers[question.id];
    if (Array.isArray(answer)) {
      return question.choices.filter((choice) => answer.includes(choice.id));
    }

    return question.choices.filter((choice) => choice.id === answer);
  });
}

function findVariant(answers: Answers): ProductVariant | undefined {
  const normalizedAnswers = normalizeAnswersForOuvrage(answers);

  if (!normalizedAnswers.capacity || !normalizedAnswers.reach) {
    return undefined;
  }

  return productVariants.find((variant) => {
    const installationMatch =
      variant.installation === normalizedAnswers.installation;
    const conceptionMatch = variant.conception === normalizedAnswers.conception;
    const capacityMatch = variant.capacity === normalizedAnswers.capacity;
    const reachMatch = variant.reach === normalizedAnswers.reach;

    return installationMatch && conceptionMatch && capacityMatch && reachMatch;
  });
}

function buildVisibleComponentLines(
  installation: ReturnType<typeof buildOuvrageInstallation>,
): ConfiguratorComponentLine[] {
  return installation.includedComponents
    .map((component, index) => {
      const quantity = getIncludedQuantity(component.quantity, component.order);

      return {
        id: `${component.code}-${component.order}-${index}`,
        label: component.label || "Élément de l’installation",
        description: component.description,
        quantity,
        unitPrice: calculateSellingPrice(component.costPrice),
        totalPrice: calculateSellingPrice(getComponentLineTotal(component)),
      };
    })
    .filter((component) => component.quantity > 0 && component.totalPrice >= 0);
}

function buildInstallationSummary(
  installation: ReturnType<typeof buildOuvrageInstallation>,
): ConfiguratorInstallationSummary {
  const includedComponentsCount = installation.includedComponents.length;
  const optionalComponentsCount = installation.optionalComponents.length;
  const includedPreview = installation.includedComponents.slice(0, 6);
  const visibleComponents = buildVisibleComponentLines(installation);
  const hiddenComponentsCount = Math.max(
    0,
    includedComponentsCount - visibleComponents.length,
  );

  if (installation.status === "solution-found" && installation.match) {
    const isExact = installation.match.exact;

    return {
      status: isExact ? "ready" : "alternative",
      eyebrow: "Solution proposée",
      title: isExact
        ? "Votre installation prend forme."
        : "Une solution approchante est disponible.",
      subtitle: isExact
        ? "Le récapitulatif se met à jour automatiquement à partir de vos choix."
        : "Ajustez vos choix pour obtenir la configuration la plus adaptée.",
      badge: isExact ? "Disponible" : "À ajuster",
      canAddToCart: isExact,
      includedComponentsCount,
      optionalComponentsCount,
      includedPreview,
      visibleComponents,
      hiddenComponentsCount,
    };
  }

  if (installation.status === "family-found") {
    return {
      status: "in-progress",
      eyebrow: "Configuration en cours",
      title: "Encore quelques informations.",
      subtitle: installation.missingFields.length
        ? `Renseignez ${installation.missingFields.join(", ")} pour afficher une solution adaptée.`
        : "Continuez le parcours pour affiner la solution.",
      badge: "En cours",
      canAddToCart: false,
      includedComponentsCount,
      optionalComponentsCount,
      includedPreview,
      visibleComponents,
      hiddenComponentsCount,
    };
  }

  if (installation.status === "not-found") {
    return {
      status: "needs-review",
      eyebrow: "Étude nécessaire",
      title: "Ajustez votre configuration.",
      subtitle:
        "Certaines combinaisons demandent encore un choix différent pour être commandées en ligne.",
      badge: "À ajuster",
      canAddToCart: false,
      includedComponentsCount,
      optionalComponentsCount,
      includedPreview,
      visibleComponents,
      hiddenComponentsCount,
    };
  }

  return {
    status: "waiting",
    eyebrow: "Votre installation",
    title: "Elle se construit en direct.",
    subtitle:
      "Répondez aux questions pour afficher progressivement la solution adaptée.",
    badge: "À compléter",
    canAddToCart: false,
    includedComponentsCount,
    optionalComponentsCount,
    includedPreview,
    visibleComponents,
    hiddenComponentsCount,
  };
}

function buildAnswerSummaryLines(
  questions: ConfiguratorQuestion[],
  answers: Answers,
): SummaryLine[] {
  return questions.flatMap((question) => {
    const answer = answers[question.id];
    if (!answer || question.kind === "automatic") return [];

    if (Array.isArray(answer)) {
      const labels = question.choices
        .filter((choice) => answer.includes(choice.id))
        .map((choice) => choice.label);

      if (!labels.length) return [];

      return [
        {
          id: `answer-${question.id}`,
          label: question.eyebrow,
          value: labels.join(", "),
          type: "answer" as const,
        },
      ];
    }

    const choice = question.choices.find((item) => item.id === answer);
    if (!choice) return [];

    return [
      {
        id: `answer-${question.id}`,
        label: question.eyebrow,
        value: choice.label,
        type: "answer" as const,
      },
    ];
  });
}

function buildBusinessSummaryLines(
  actions: ReturnType<typeof businessDecisionEngine.evaluate>["actions"],
): SummaryLine[] {
  const addActions = actions.filter((action) => action.type === "add");
  const seen = new Set<string>();

  return addActions.flatMap((action) => {
    if (seen.has(action.ref)) return [];
    seen.add(action.ref);

    const product = findErpProduct(action.ref);

    return [
      {
        id: `business-${action.ref}`,
        label: "Élément ajouté",
        value: product?.label ?? "Option sélectionnée",
        priceImpact: product
          ? calculateSellingPrice(product.costPrice * (action.quantity ?? 1))
          : undefined,
        type: "business" as const,
      },
    ];
  });
}

function getBusinessOptionsTotal(
  actions: ReturnType<typeof businessDecisionEngine.evaluate>["actions"],
) {
  const refs = new Set<string>();

  return roundPrice(
    actions.reduce((total, action) => {
      if (action.type !== "add") return total;
      if (refs.has(action.ref)) return total;
      refs.add(action.ref);

      const product = findErpProduct(action.ref);
      return total + (product?.costPrice ?? 0) * (action.quantity ?? 1);
    }, 0),
  );
}

function getDynamicBusinessActions(answers: Answers): ComponentAction[] {
  const actions: ComponentAction[] = [];

  if (answers.fixing === "gabarit-ancrage") {
    const gabarit = findComponentByPrefix(answers, ["GAB"]);
    if (gabarit) {
      actions.push({
        type: "add",
        ref: gabarit.code,
        reason: "Fixation adaptée automatiquement à la solution sélectionnée.",
      });
    }
  }

  if (answers.fixing === "semelle-cheviller") {
    const semelle = findComponentByPrefix(answers, ["SC"]);
    if (semelle) {
      actions.push({
        type: "add",
        ref: semelle.code,
        reason: "Fixation adaptée automatiquement à la solution sélectionnée.",
      });
    }
  }

  if (["PFI", "PFT"].includes(getSelectedPotenceFamilyId(answers) ?? "")) {
    const selectedHsfM = parseMetersChoice(answers.underBeamHeight);
    const row = getSelectedTechnicalRow(answers);
    const hsfSupplement = findComponentByPrefix(answers, ["HSF"]);

    if (row && selectedHsfM && hsfSupplement) {
      const increments = Math.max(
        0,
        Math.round((selectedHsfM - row.standardHsfM) * 10),
      );

      if (increments > 0) {
        actions.push({
          type: "add",
          ref: hsfSupplement.code,
          quantity: increments,
          reason: `${increments} supplément${increments > 1 ? "s" : ""} de 10 cm de hauteur sous fer.`,
        });
      }
    }
  }

  const wallFixing = findWallFixingComponent(answers);
  if (wallFixing) {
    actions.push({
      type: "add",
      ref: wallFixing.code,
      reason: "Fixation murale adaptée automatiquement au support renseigné.",
    });
  }

  return [...actions, ...getHoistBusinessActions(answers)];
}

export function buildConfiguration({
  answers,
  stepIndex,
  selectedAccessoryIds,
}: {
  answers: Answers;
  stepIndex: number;
  selectedAccessoryIds: string[];
}): EngineResult {
  const activeFamilyId = getActiveFamilyId(answers);
  const family = getBusinessFamily(activeFamilyId);
  const businessDecision = businessDecisionEngine.evaluateFamily(
    family,
    answers,
  );
  const dynamicBusinessActions = getDynamicBusinessActions(answers);
  const allBusinessActions = [
    ...businessDecision.actions,
    ...dynamicBusinessActions,
  ];
  const questions = getBusinessQuestions(answers);
  const currentQuestion =
    questions[Math.min(stepIndex, questions.length - 1)] ??
    questions[0] ??
    configuratorQuestions[0];
  const selectedChoices = getSelectedChoices(questions, answers);
  const selectedVariant = findVariant(answers);
  const erpInstallation = buildOuvrageInstallation(
    normalizeAnswersForOuvrage(answers),
  );
  const installationSummary = buildInstallationSummary(erpInstallation);
  const compatibleAccessories = getCompatibleAccessories(answers);
  const requiredAccessories = compatibleAccessories.filter(
    (accessory) => accessory.required,
  );

  const requiredIds = requiredAccessories.map((accessory) => accessory.id);
  const normalizedSelectedIds = Array.from(
    new Set([...selectedAccessoryIds, ...requiredIds]),
  );

  const selectedAccessories = compatibleAccessories.filter((accessory) =>
    normalizedSelectedIds.includes(accessory.id),
  );

  const businessOptionsCostTotal = getBusinessOptionsTotal(allBusinessActions);
  const hoistDetail = getHoistDetail(answers);
  const baseCostPrice =
    erpInstallation.basePrice || selectedVariant?.price || 0;
  const optionsTotal = calculateSellingPrice(businessOptionsCostTotal);
  const accessoriesTotal = selectedAccessories.reduce(
    (total, accessory) => total + accessory.price,
    0,
  );
  const solutionCostTotal =
    erpInstallation.includedTotal || erpInstallation.total || baseCostPrice;
  const solutionTotal = calculateSellingPrice(solutionCostTotal);
  const hoistTotal = hoistDetail?.totalHt ?? 0;
  // Le palan dispose de sa propre ligne dans le récapitulatif.
  // Les compléments ne doivent donc contenir que les options et accessoires.
  const complementsTotal = accessoriesTotal + optionsTotal;
  const total = solutionTotal + hoistTotal + complementsTotal;
  const priceBreakdown = {
    solutionTotal: roundPrice(solutionTotal),
    hoistTotal: roundPrice(hoistTotal),
    complementsTotal: roundPrice(complementsTotal),
    totalHt: roundPrice(total),
  };

  const productSummaryLine: SummaryLine[] = erpInstallation.match
    ? [
        {
          id: `solution-${erpInstallation.match.ouvrage.code}`,
          label: "Solution sélectionnée",
          value: erpInstallation.match.ouvrage.label,
          priceImpact: priceBreakdown.solutionTotal,
          type: "product",
        },
      ]
    : selectedVariant
      ? [
          {
            id: `product-${selectedVariant.id}`,
            label: "Solution sélectionnée",
            value: selectedVariant.label,
            priceImpact: selectedVariant.price,
            type: "product",
          },
        ]
      : [];

  const selectedHoist = getSelectedHoistInfo(answers);
  const hoistSummaryLine: SummaryLine[] = selectedHoist
    ? [
        {
          id: "hoist-selection",
          label: "Palan sélectionné",
          value: hoistDetail?.subtitle ? `${selectedHoist.title} · ${hoistDetail.subtitle}` : selectedHoist.title,
          priceImpact: hoistDetail?.totalHt,
          type: "business",
        },
      ]
    : [];

  const accessorySummaryLines: SummaryLine[] = selectedAccessories.map(
    (accessory) => ({
      id: `accessory-${accessory.id}`,
      label: accessory.label,
      value: accessory.required ? "Ajouté automatiquement" : "Ajouté au panier",
      priceImpact: accessory.price,
      type: "accessory",
    }),
  );

  const summaryLines = [
    ...productSummaryLine,
    ...buildAnswerSummaryLines(questions, answers),
    ...hoistSummaryLine,
    ...buildBusinessSummaryLines(allBusinessActions),
    ...getRuleSummaryLines(answers as Record<string, string>),
    ...accessorySummaryLines,
  ];

  const answeredQuestions = questions.filter((question) => {
    const answer = answers[question.id];
    return Array.isArray(answer) ? answer.length > 0 : Boolean(answer);
  }).length;

  return {
    answers,
    questions,
    currentQuestion,
    selectedChoices,
    selectedVariant,
    erpInstallation,
    installationSummary,
    businessDecision,
    businessFamilyLabel: family.shortLabel,
    compatibleAccessories,
    requiredAccessories,
    selectedAccessories,
    summaryLines,
    warnings: getRuleWarnings(answers as Record<string, string>),
    basePrice: calculateSellingPrice(baseCostPrice),
    optionsTotal,
    accessoriesTotal,
    hoistDetail,
    priceBreakdown,
    total: priceBreakdown.totalHt,
    progress: questions.length
      ? Math.round((answeredQuestions / questions.length) * 100)
      : 0,
  };
}

export function getVisibleBusinessQuestions(answers: Answers) {
  return getBusinessQuestions(answers);
}
