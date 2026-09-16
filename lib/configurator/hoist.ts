import { findErpProduct, roundPrice } from "@/lib/erp";
import { getErpOuvrages, getErpProducts } from "@/lib/erp/repositories";
import type { ComponentAction } from "@/lib/business";
import type {
  Answers,
  ConfiguratorComponentLine,
  HoistDetail,
  HoistDetailNote,
} from "./types";
import { calculateHoistSellingPrice } from "./pricing";

const EQ_LIMIT_KG = 1000;
const MANUAL_HOIST_BASE_HEIGHT_M = 3;
const MANUAL_TROLLEY_CHAIN_BASE_HEIGHT_M = 2.5;

const MANUAL_HOIST_BASE_WEIGHT_KG: Record<number, number> = {
  500: 9,
  1000: 12,
  1500: 18,
  1600: 19,
  2000: 19,
  3000: 31,
  5000: 40,
};

const MANUAL_CHAIN_WEIGHT_PER_M_KG: Record<number, number> = {
  500: 0.5,
  1000: 0.8,
  1500: 1.4,
  1600: 1.4,
  2000: 1.4,
  3000: 2.2,
  5000: 4,
};

const EQ_BASE_WEIGHT_KG: Record<number, number> = {
  125: 30,
  150: 30,
  250: 30,
  500: 32,
  1000: 42,
};

const ER2_WEIGHT_DATA: Record<number, { base: number; extraPerM: number }> = {
  1600: { base: 72, extraPerM: 2.3 },
  2000: { base: 89, extraPerM: 2.3 },
  2500: { base: 100, extraPerM: 2.8 },
  3000: { base: 105, extraPerM: 4.7 },
  3200: { base: 105, extraPerM: 4.7 },
  5000: { base: 128, extraPerM: 5.6 },
};

const CAPACITY_CODE_BY_KG: Record<number, string[]> = {
  125: ["001"],
  150: ["001", "003"],
  250: ["003"],
  500: ["005"],
  1000: ["010"],
  1600: ["016"],
  2000: ["020", "020S", "020L"],
  3000: ["030"],
  5000: ["050"],
};

const ELECTRIC_COMMAND_LABELS: Record<string, string> = {
  radio: "Radiocommande",
  "button-box": "Boîte à boutons",
};

function parseNumber(value?: string | string[]) {
  if (Array.isArray(value)) return undefined;
  if (!value) return undefined;
  const normalized = value.replace(",", ".").replace(/[^\d.]/g, "");
  const numeric = Number.parseFloat(normalized);
  return Number.isFinite(numeric) ? numeric : undefined;
}

function getLiftingHeightMeters(answers: Answers) {
  return parseNumber(answers.liftingHeight) ?? MANUAL_HOIST_BASE_HEIGHT_M;
}

function normalizeRef(ref: string) {
  return ref.trim().toUpperCase();
}

function extractCapacityFromLabel(label: string) {
  const match = label.match(/(\d+(?:[,.]\d+)?)\s*kg/i);
  if (!match) return undefined;
  const value = Number.parseFloat(match[1].replace(",", "."));
  return Number.isFinite(value) ? Math.round(value) : undefined;
}

function findProductByPrefixAndCapacity(prefix: string, capacityKg: number) {
  const normalizedPrefix = normalizeRef(prefix);
  const products = getErpProducts().filter((product) =>
    normalizeRef(product.ref).startsWith(normalizedPrefix),
  );

  const exactByLabel = products.find(
    (product) => extractCapacityFromLabel(product.label) === capacityKg,
  );
  if (exactByLabel) return exactByLabel;

  const codeCandidates = CAPACITY_CODE_BY_KG[capacityKg] ?? [];
  const exactByCode = products.find((product) => {
    const ref = normalizeRef(product.ref);
    return codeCandidates.some((code) =>
      ref.startsWith(`${normalizedPrefix}${code}`),
    );
  });
  if (exactByCode) return exactByCode;

  return products
    .map((product) => ({
      product,
      capacity: extractCapacityFromLabel(product.label),
    }))
    .filter(
      (
        item,
      ): item is { product: (typeof products)[number]; capacity: number } =>
        item.capacity !== undefined,
    )
    .filter((item) => item.capacity >= capacityKg)
    .sort(
      (a, b) =>
        a.capacity - b.capacity || a.product.ref.localeCompare(b.product.ref),
    )[0]?.product;
}

function findOuvrageByPrefixAndCapacity(prefix: string, capacityKg: number) {
  const normalizedPrefix = normalizeRef(prefix);
  const ouvrages = getErpOuvrages().filter((ouvrage) =>
    normalizeRef(ouvrage.code).startsWith(normalizedPrefix),
  );

  const codeCandidates = CAPACITY_CODE_BY_KG[capacityKg] ?? [];
  const exactByCode = ouvrages.find((ouvrage) => {
    const code = normalizeRef(ouvrage.code);
    return codeCandidates.some((candidate) =>
      code.startsWith(`${normalizedPrefix}${candidate}`),
    );
  });
  if (exactByCode) return exactByCode;

  const exactByLabel = ouvrages.find(
    (ouvrage) => extractCapacityFromLabel(ouvrage.label) === capacityKg,
  );
  if (exactByLabel) return exactByLabel;

  return ouvrages
    .map((ouvrage) => ({
      ouvrage,
      capacity: extractCapacityFromLabel(ouvrage.label),
    }))
    .filter(
      (
        item,
      ): item is { ouvrage: (typeof ouvrages)[number]; capacity: number } =>
        item.capacity !== undefined,
    )
    .filter((item) => item.capacity >= capacityKg)
    .sort(
      (a, b) =>
        a.capacity - b.capacity || a.ouvrage.code.localeCompare(b.ouvrage.code),
    )[0]?.ouvrage;
}

function findManualHoist(capacityKg: number) {
  const exact = findErpProduct(`VSIII${capacityKg}KG`);
  if (exact) return exact;

  return findProductByPrefixAndCapacity("VSIII", capacityKg);
}

function findManualExtraMeterComponent(capacityKg: number) {
  const exact = findErpProduct(`MSUPLEV_YALE_VSIII${capacityKg}`);
  if (exact) return exact;

  return (
    findErpProduct("MSUPLEV_YALE_VSIII1000") ??
    findProductByPrefixAndCapacity("MSUPLEV_YALE_VSIII", capacityKg)
  );
}

function findManualTrolley(capacityKg: number, movement: "push" | "chain") {
  const normalizedCapacity = capacityKg === 1600 ? 2000 : capacityKg;
  return findErpProduct(`${movement === "chain" ? "HTG" : "HTP"}${normalizedCapacity}A`);
}

function findManualManeuverChainComponent() {
  return findErpProduct("MSUPMANZING_YALE_VSIII_YL360_HTG");
}

function hasChoice(answers: Answers, answerId: string, choiceId: string) {
  const value = answers[answerId];
  return Array.isArray(value) ? value.includes(choiceId) : value === choiceId;
}

function getElectricTechnicalWeight(capacityKg: number, liftingHeightM: number) {
  if (capacityKg <= EQ_LIMIT_KG) {
    return EQ_BASE_WEIGHT_KG[capacityKg] ?? EQ_BASE_WEIGHT_KG[1000];
  }
  const data = ER2_WEIGHT_DATA[capacityKg] ?? Object.entries(ER2_WEIGHT_DATA)
    .map(([capacity, value]) => ({ capacity: Number(capacity), value }))
    .filter((item) => item.capacity >= capacityKg)
    .sort((a, b) => a.capacity - b.capacity)[0]?.value;
  if (!data) return undefined;
  return data.base + Math.max(0, liftingHeightM - 3) * data.extraPerM;
}

function getElectricHoistPrefix(answers: Answers, capacityKg: number) {
  const base = capacityKg <= EQ_LIMIT_KG ? "EQ" : "ER2";
  const movement = answers.hoistTrolleyMovement === "motorized" ? "M" : "SP";
  return `${base}${movement}`;
}

function isButtonBoxCommand(answers: Answers) {
  return answers.hoistCommand === "button-box";
}

function isRadioCommand(answers: Answers) {
  return answers.hoistCommand === "radio";
}

function createDetailLine({
  id,
  label,
  description,
  quantity,
  unitCost,
}: {
  id: string;
  label: string;
  description?: string;
  quantity: number;
  unitCost: number;
}): ConfiguratorComponentLine {
  return {
    id,
    label,
    description,
    quantity,
    unitPrice: calculateHoistSellingPrice(unitCost),
    totalPrice: calculateHoistSellingPrice(unitCost * quantity),
  };
}

function componentMatches(code: string, label: string, patterns: RegExp[]) {
  const source = `${code} ${label}`.toUpperCase();
  return patterns.some((pattern) => pattern.test(source));
}

function buildElectricLineNotes(answers: Answers, liftingHeightM: number) {
  const notes: HoistDetailNote[] = [
    {
      label: "Hauteur de levage",
      value: `${liftingHeightM} m`,
      description: "Calculée au mètre.",
    },
    {
      label: "Bac à chaîne",
      value: liftingHeightM <= 6 ? "Bac 6 m" : "Bac 15 m",
      description:
        liftingHeightM <= 6
          ? "Sélection automatique pour une hauteur de 3 à 6 m."
          : "Sélection automatique pour une hauteur de 7 à 15 m.",
    },
  ];

  if (answers.hoistTrolleyMovement === "push") {
    notes.push({
      label: "Raccordement électrique",
      value: "À la charge du client",
      description: "Le raccordement du palan à la ligne d’alimentation doit être réalisé sur site.",
    });
  }

  if (isButtonBoxCommand(answers)) {
    notes.push({
      label: "Longueur câble de commande",
      value: `${Math.max(0, liftingHeightM - 0.5)} m`,
      description: "Hauteur de levage - 0,5 m.",
    });
  }

  return notes;
}

function getElectricQuantity({
  code,
  label,
  answers,
  liftingHeightM,
}: {
  code: string;
  label: string;
  answers: Answers;
  liftingHeightM: number;
}) {
  const upperCode = normalizeRef(code);
  const upperLabel = label.toUpperCase();
  const source = `${upperCode} ${upperLabel}`;

  if (
    componentMatches(code, label, [
      /HARTING/,
      /RACCORDEMENT/,
      /CABLAGE_ER2_EQ_ED/,
    ])
  ) {
    return 0;
  }

  if (componentMatches(code, label, [/LARGW30/, /164\s*-\s*305/, /164-305/])) {
    return 0;
  }

  if (componentMatches(code, label, [/CROCHET BAS INOX/, /CRO_INOX/])) {
    return hasChoice(answers, "hoistOptions", "stainless-hook") ? 1 : 0;
  }

  if (
    componentMatches(code, label, [
      /MÈTRE DE LEVAGE/,
      /METRE DE LEVAGE/,
      /^HLER2/,
      /^HLEQ/,
    ])
  ) {
    return liftingHeightM;
  }

  if (componentMatches(code, label, [/BAC.*6M/, /_6M/])) {
    return liftingHeightM <= 6 ? 1 : 0;
  }

  if (componentMatches(code, label, [/BAC.*15M/, /_15M/])) {
    return liftingHeightM > 6 ? 1 : 0;
  }

  if (componentMatches(code, label, [/BAC.*8M/, /_8M/, /76M/])) {
    return 0;
  }

  if (componentMatches(code, label, [/RADIO/])) {
    return isRadioCommand(answers) ? 1 : 0;
  }

  if (
    componentMatches(code, label, [
      /CÂBLE DE BOITE/,
      /CABLE DE BOITE/,
      /CABLEBAB/,
    ])
  ) {
    return isButtonBoxCommand(answers) ? Math.max(0, liftingHeightM - 0.5) : 0;
  }

  if (
    componentMatches(code, label, [/BOITE À BOUTONS/, /BOITE A BOUTONS/, /BAB/])
  ) {
    return isButtonBoxCommand(answers) ? 1 : 0;
  }

  if (
    componentMatches(code, label, [
      /CORPS/,
      /CHARIOT MOTORISÉ/,
      /CHARIOT MOTORISE/,
      /CHARIOT TSP/,
      /LARGEUR DE FER 58/,
      /58\s*-\s*163/,
      /58-163/,
      /BUT[ÉE]ES?/,
      /FIN DE COURSE/,
      /FDC/,
      /TRANSPORT USINE/,
      /IMPORT_KITO/,
      /ALIMENTATION/,
      /ALIMEQ/,
    ])
  ) {
    return 1;
  }

  return 0;
}

function buildElectricHoistDetail(answers: Answers): HoistDetail | undefined {
  const capacityKg = parseNumber(answers.capacity);
  if (!capacityKg || !answers.hoistTrolleyMovement) return undefined;

  const prefix = getElectricHoistPrefix(answers, capacityKg);
  const ouvrage = findOuvrageByPrefixAndCapacity(prefix, capacityKg);
  const product = ouvrage
    ? undefined
    : findProductByPrefixAndCapacity(prefix, capacityKg);
  const liftingHeightM = getLiftingHeightMeters(answers);
  const commandLabel =
    typeof answers.hoistCommand === "string"
      ? ELECTRIC_COMMAND_LABELS[answers.hoistCommand]
      : undefined;

  const componentLines = (ouvrage?.components ?? [])
    .map((component, index) => {
      const quantity = getElectricQuantity({
        code: component.code,
        label: component.label,
        answers,
        liftingHeightM,
      });

      if (quantity <= 0) return undefined;

      return createDetailLine({
        id: `hoist-${ouvrage?.code}-${component.code}-${index}`,
        label: component.label || component.code,
        description: component.code,
        quantity,
        unitCost: component.costPrice,
      });
    })
    .filter((line): line is ConfiguratorComponentLine => Boolean(line));

  const fallbackLine =
    !ouvrage && product
      ? [
          createDetailLine({
            id: `hoist-product-${product.ref}`,
            label: product.label,
            description: product.ref,
            quantity: 1,
            unitCost: product.costPrice,
          }),
        ]
      : [];

  const lines = componentLines.length ? [...componentLines] : [...fallbackLine];

  if (answers.environment === "exterieur") {
    const outdoorBox = findErpProduct("COFBABA");
    if (outdoorBox) {
      lines.push(createDetailLine({
        id: `hoist-outdoor-${outdoorBox.ref}`,
        label: outdoorBox.label,
        description: outdoorBox.ref,
        quantity: 1,
        unitCost: outdoorBox.costPrice,
      }));
    }
  }

  const totalHt = roundPrice(
    lines.reduce((total, line) => total + line.totalPrice, 0),
  );

  return {
    mode: "electric",
    familyPrefix: prefix,
    reference: ouvrage?.code ?? product?.ref,
    title:
      answers.hoistTrolleyMovement === "motorized"
        ? "Palan électrique avec chariot motorisé"
        : "Palan électrique avec chariot par poussée",
    subtitle: `${capacityKg} kg${commandLabel ? ` · ${commandLabel}` : ""}`,
    capacityKg,
    liftingHeightM,
    commandLabel,
    trolleyMovementLabel:
      answers.hoistTrolleyMovement === "motorized"
        ? "Chariot motorisé"
        : "Chariot par poussée",
    chainBucketLabel:
      liftingHeightM <= 6 ? "Bac à chaîne 6 m" : "Bac à chaîne 15 m",
    controlCableLengthM: isButtonBoxCommand(answers)
      ? Math.max(0, liftingHeightM - 0.5)
      : undefined,
    componentLines: lines,
    notes: buildElectricLineNotes(answers, liftingHeightM),
    totalHt,
    weightKg: getElectricTechnicalWeight(capacityKg, liftingHeightM),
    weightComplete: answers.hoistTrolleyMovement === "push",
  };
}

function buildManualHoistDetail(answers: Answers): HoistDetail | undefined {
  const capacityKg = parseNumber(answers.capacity);
  const movement = answers.hoistTrolleyMovement;
  if (!capacityKg || (movement !== "push" && movement !== "chain")) return undefined;

  const hoist = findManualHoist(capacityKg);
  const trolley = findManualTrolley(capacityKg, movement);
  const liftingHeightM = getLiftingHeightMeters(answers);
  const extraMeters = Math.max(0, liftingHeightM - MANUAL_HOIST_BASE_HEIGHT_M);
  const extraMeterComponent = extraMeters > 0 ? findManualExtraMeterComponent(capacityKg) : undefined;
  const maneuverExtraMeters = movement === "chain"
    ? Math.max(0, liftingHeightM - MANUAL_TROLLEY_CHAIN_BASE_HEIGHT_M)
    : 0;
  const maneuverChain = maneuverExtraMeters > 0 ? findManualManeuverChainComponent() : undefined;

  const lines: ConfiguratorComponentLine[] = [];
  for (const product of [hoist, trolley]) {
    if (!product) continue;
    lines.push(createDetailLine({
      id: `hoist-manual-${product.ref}`,
      label: product.label,
      description: product.ref,
      quantity: 1,
      unitCost: product.costPrice,
    }));
  }

  if (extraMeterComponent && extraMeters > 0) {
    lines.push(createDetailLine({
      id: `hoist-manual-extra-${extraMeterComponent.ref}`,
      label: extraMeterComponent.label,
      description: extraMeterComponent.ref,
      quantity: extraMeters,
      unitCost: extraMeterComponent.costPrice,
    }));
  }

  if (maneuverChain && maneuverExtraMeters > 0) {
    lines.push(createDetailLine({
      id: `hoist-manual-maneuver-${maneuverChain.ref}`,
      label: maneuverChain.label,
      description: maneuverChain.ref,
      quantity: maneuverExtraMeters,
      unitCost: maneuverChain.costPrice,
    }));
  }

  const knownWeight = (MANUAL_HOIST_BASE_WEIGHT_KG[capacityKg] ?? 0)
    + extraMeters * (MANUAL_CHAIN_WEIGHT_PER_M_KG[capacityKg] ?? 0)
    + maneuverExtraMeters * (MANUAL_CHAIN_WEIGHT_PER_M_KG[capacityKg] ?? 0);

  return {
    mode: "manual",
    familyPrefix: "VSIII",
    reference: hoist?.ref,
    title: movement === "chain"
      ? "Palan manuel avec chariot par chaîne"
      : "Palan manuel avec chariot par poussée",
    subtitle: `${capacityKg} kg · ${liftingHeightM} m de levage`,
    capacityKg,
    liftingHeightM,
    trolleyMovementLabel: movement === "chain" ? "Chariot par chaîne HTG" : "Chariot par poussée HTP",
    componentLines: lines,
    notes: [
      { label: "Hauteur de levage incluse", value: "3 m", description: "Base standard du palan manuel Yale VSIII." },
      ...(movement === "chain" ? [{ label: "Chaîne de manœuvre incluse", value: "2,5 m", description: "Les mètres supplémentaires sont calculés automatiquement." }] : []),
      ...(extraMeters > 0 ? [{ label: "Levage supplémentaire", value: `${extraMeters} m`, description: "Ajouté automatiquement au-delà des 3 m inclus." }] : []),
      ...(maneuverExtraMeters > 0 ? [{ label: "Chaîne de manœuvre supplémentaire", value: `${maneuverExtraMeters} m`, description: "Ajoutée automatiquement au-delà des 2,5 m inclus." }] : []),
    ],
    totalHt: roundPrice(lines.reduce((total, line) => total + line.totalPrice, 0)),
    weightKg: knownWeight || undefined,
    weightComplete: false,
  };
}

export function getSelectedHoistInfo(answers: Answers) {
  const capacityKg = parseNumber(answers.capacity);
  if (answers.hoist !== "yes" || !capacityKg) return undefined;

  if (answers.hoistType === "manual") {
    const detail = buildManualHoistDetail(answers);
    return {
      mode: "manual" as const,
      capacityKg,
      title: detail?.title ?? "Palan manuel Yale VSIII",
      mainRef: detail?.reference,
      mainLabel: detail?.reference,
      extraMeters: Math.max(
        0,
        getLiftingHeightMeters(answers) - MANUAL_HOIST_BASE_HEIGHT_M,
      ),
    };
  }

  if (answers.hoistType === "electric" && answers.hoistTrolleyMovement) {
    const detail = buildElectricHoistDetail(answers);

    return {
      mode: "electric" as const,
      capacityKg,
      prefix:
        detail?.familyPrefix ?? getElectricHoistPrefix(answers, capacityKg),
      title:
        detail?.title ??
        (answers.hoistTrolleyMovement === "motorized"
          ? "Palan électrique avec chariot motorisé"
          : "Palan électrique avec chariot par poussée"),
      mainRef: detail?.reference,
      mainLabel: detail?.reference,
      extraMeters: 0,
    };
  }

  return undefined;
}

export function getHoistDetail(answers: Answers): HoistDetail | undefined {
  if (answers.hoist !== "yes") return undefined;
  if (answers.hoistType === "manual") return buildManualHoistDetail(answers);
  if (answers.hoistType === "electric")
    return buildElectricHoistDetail(answers);
  return undefined;
}

export function getHoistBusinessActions(_answers: Answers): ComponentAction[] {
  return [];
}

export function getHoistCost(answers: Answers) {
  const detail = getHoistDetail(answers);
  if (detail) return roundPrice(detail.totalHt * 0.75);

  return roundPrice(
    getHoistBusinessActions(answers).reduce((total, action) => {
      if (action.type !== "add") return total;
      const product = findErpProduct(action.ref);
      return total + (product?.costPrice ?? 0) * (action.quantity ?? 1);
    }, 0),
  );
}
