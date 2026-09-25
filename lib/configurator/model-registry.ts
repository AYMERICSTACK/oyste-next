import {
  PFI_ELECTRIC_TROLLEY_ELECTRIC_HOIST_PRESET,
  PFI_MANUAL_TROLLEY_ELECTRIC_HOIST_PRESET,
  PFI_MANUAL_TROLLEY_MANUAL_HOIST_PRESET,
} from "./model-presets";
import type {
  Configurator3DState,
  ConfiguratorModelFamily,
  ConfiguratorModelPreset,
} from "./model-types";

export type ConfiguratorVisualMode = "3d" | "preview";

export type ConfiguratorFamilyExperience = {
  family: ConfiguratorModelFamily;
  label: string;
  shortLabel: string;
  visualMode: ConfiguratorVisualMode;
  threeDAvailable: boolean;
  previewEyebrow: string;
  previewTitle: string;
  previewDescription: string;
};

export const FAMILY_EXPERIENCES: Record<
  ConfiguratorModelFamily,
  ConfiguratorFamilyExperience
> = {
  PFI: {
    family: "PFI",
    label: "Potence sur fût inversée",
    shortLabel: "PFI",
    visualMode: "3d",
    threeDAvailable: true,
    previewEyebrow: "Visualisation 3D",
    previewTitle: "Votre PFI en temps réel",
    previewDescription:
      "Le modèle évolue automatiquement avec les choix de votre configuration.",
  },
  PFT: {
    family: "PFT",
    label: "Potence sur fût triangulée",
    shortLabel: "PFT",
    visualMode: "preview",
    threeDAvailable: false,
    previewEyebrow: "3D en préparation",
    previewTitle: "Visualisation 3D en préparation",
    previewDescription:
      "Vous pouvez configurer entièrement cette solution. Son aperçu 3D interactif sera intégré prochainement.",
  },
  PMI: {
    family: "PMI",
    label: "Potence murale inversée",
    shortLabel: "PMI",
    visualMode: "preview",
    threeDAvailable: false,
    previewEyebrow: "3D en préparation",
    previewTitle: "Visualisation 3D en préparation",
    previewDescription:
      "Vous pouvez configurer entièrement cette solution. Son aperçu 3D interactif sera intégré prochainement.",
  },
  PMT: {
    family: "PMT",
    label: "Potence murale triangulée",
    shortLabel: "PMT",
    visualMode: "preview",
    threeDAvailable: false,
    previewEyebrow: "3D en préparation",
    previewTitle: "Visualisation 3D en préparation",
    previewDescription:
      "Vous pouvez configurer entièrement cette solution. Son aperçu 3D interactif sera intégré prochainement.",
  },
  PMA: {
    family: "PMA",
    label: "Potence murale articulée",
    shortLabel: "PMA",
    visualMode: "preview",
    threeDAvailable: false,
    previewEyebrow: "3D en préparation",
    previewTitle: "Visualisation 3D en préparation",
    previewDescription:
      "Vous pouvez configurer entièrement cette solution. Son aperçu 3D interactif sera intégré prochainement.",
  },
  PMAM: {
    family: "PMAM",
    label: "Potence murale articulée motorisée",
    shortLabel: "PMAM",
    visualMode: "preview",
    threeDAvailable: false,
    previewEyebrow: "3D en préparation",
    previewTitle: "Visualisation 3D en préparation",
    previewDescription:
      "Vous pouvez configurer entièrement cette solution. Son aperçu 3D interactif sera intégré prochainement.",
  },
};

export const MODEL_REGISTRY: Partial<
  Record<ConfiguratorModelFamily, readonly ConfiguratorModelPreset[]>
> = {
  PFI: [
    PFI_ELECTRIC_TROLLEY_ELECTRIC_HOIST_PRESET,
    PFI_MANUAL_TROLLEY_ELECTRIC_HOIST_PRESET,
    PFI_MANUAL_TROLLEY_MANUAL_HOIST_PRESET,
  ],
};

export function getConfiguratorFamilyExperience(
  family?: ConfiguratorModelFamily,
) {
  return family ? FAMILY_EXPERIENCES[family] : undefined;
}

export function getConfiguratorModel(state?: Configurator3DState) {
  if (!state?.craneType) return undefined;
  const familyModels = MODEL_REGISTRY[state.craneType];
  if (!familyModels?.length) return undefined;

  if (state.hoistType === "manual") {
    return (
      familyModels.find(
        (preset) => preset.variant === "manual-trolley-manual-hoist",
      ) ?? familyModels[0]
    );
  }

  if (
    state.hoistType === "electric" &&
    state.trolleyMovement &&
    state.trolleyMovement !== "motorized"
  ) {
    return (
      familyModels.find(
        (preset) => preset.variant === "manual-trolley-electric-hoist",
      ) ?? familyModels[0]
    );
  }

  return (
    familyModels.find(
      (preset) => preset.variant === "electric-trolley-electric-hoist",
    ) ?? familyModels[0]
  );
}
