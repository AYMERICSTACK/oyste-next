import { findErpProduct, roundPrice } from "@/lib/erp";
import { getErpOuvrages, getErpProducts } from "@/lib/erp/repositories";
import type { ComponentAction } from "@/lib/business";
import type {
  Answers,
  ConfiguratorComponentLine,
  HoistDetail,
  HoistDetailNote,
} from "./types";
import { calculateSellingPrice } from "./pricing";

const EQ_LIMIT_KG = 1000;
const MANUAL_HOIST_BASE_HEIGHT_M = 3;

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
    unitPrice: calculateSellingPrice(unitCost),
    totalPrice: calculateSellingPrice(unitCost * quantity),
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
    return 0;
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

  const lines = componentLines.length ? componentLines : fallbackLine;
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
  };
}

function buildManualHoistDetail(answers: Answers): HoistDetail | undefined {
  const capacityKg = parseNumber(answers.capacity);
  if (!capacityKg) return undefined;

  const hoist = findManualHoist(capacityKg);
  const liftingHeightM = getLiftingHeightMeters(answers);
  const extraMeters = Math.max(0, liftingHeightM - MANUAL_HOIST_BASE_HEIGHT_M);
  const extraMeterComponent =
    extraMeters > 0 ? findManualExtraMeterComponent(capacityKg) : undefined;

  const lines: ConfiguratorComponentLine[] = [];

  if (hoist) {
    lines.push(
      createDetailLine({
        id: `hoist-manual-${hoist.ref}`,
        label: hoist.label,
        description: hoist.ref,
        quantity: 1,
        unitCost: hoist.costPrice,
      }),
    );
  }

  if (extraMeterComponent && extraMeters > 0) {
    lines.push(
      createDetailLine({
        id: `hoist-manual-extra-${extraMeterComponent.ref}`,
        label: extraMeterComponent.label,
        description: extraMeterComponent.ref,
        quantity: extraMeters,
        unitCost: extraMeterComponent.costPrice,
      }),
    );
  }

  return {
    mode: "manual",
    familyPrefix: "VSIII",
    reference: hoist?.ref,
    title: "Palan manuel avec chariot par poussée",
    subtitle: `${capacityKg} kg · ${liftingHeightM} m de levage`,
    capacityKg,
    liftingHeightM,
    trolleyMovementLabel: "Chariot par poussée",
    componentLines: lines,
    notes: [
      {
        label: "Hauteur incluse",
        value: "3 m",
        description: "Base standard du palan manuel.",
      },
      ...(extraMeters > 0
        ? [
            {
              label: "Levage supplémentaire",
              value: `${extraMeters} m`,
              description: "Ajouté automatiquement au-delà des 3 m inclus.",
            },
          ]
        : []),
    ],
    totalHt: roundPrice(
      lines.reduce((total, line) => total + line.totalPrice, 0),
    ),
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
      title: detail?.title ?? "Palan manuel avec chariot par poussée",
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
