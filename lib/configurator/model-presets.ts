import electricElectricJson from "./presets/pfi-electric-trolley-electric-hoist.json";
import manualElectricJson from "./presets/pfi-manual-trolley-electric-hoist.json";
import manualManualJson from "./presets/pfi-manual-trolley-manual-hoist.json";
import type {
  ConfiguratorAssemblyVariant,
  ConfiguratorMeshGroups,
  ConfiguratorModelPreset,
  ConfiguratorModuleGroup,
  LabPresetJson,
} from "./model-types";

const FALLBACK_CAMERA = {
  position: [-0.1951, 5.2498, 12.4911] as const,
  target: [0, 3.025, 0] as const,
  fov: 38,
  zoom: 1,
};

const COMMON_TRANSFORM = {
  rotation: [-180, 180, 180] as const,
  position: [-0.4, -0.2, 0.25] as const,
  scale: 1,
};

const ELECTRIC_ELECTRIC_PRESET = electricElectricJson as unknown as LabPresetJson;
const MANUAL_ELECTRIC_PRESET = manualElectricJson as unknown as LabPresetJson;
const MANUAL_MANUAL_PRESET = manualManualJson as unknown as LabPresetJson;

const GROUP_ALIASES: Record<string, ConfiguratorModuleGroup> = {
  structure: "structure",
  potence: "structure",
  hoist: "hoist",
  palan: "hoist",
  trolley: "trolley",
  "chariot-manuel": "trolley",
  powerSupply: "powerSupply",
  mainSwitch: "mainSwitch",
  ignore: "ignore",
};

function normalizeGroups(source: LabPresetJson): ConfiguratorMeshGroups {
  const groups: Record<ConfiguratorModuleGroup, string[]> = {
    structure: [],
    hoist: [],
    trolley: [],
    powerSupply: [],
    mainSwitch: [],
    ignore: [],
  };

  Object.entries(source.groups).forEach(([key, definition]) => {
    const normalized = GROUP_ALIASES[key];
    if (normalized) groups[normalized].push(...definition.meshes);
  });

  Object.entries(source.validation?.records ?? {}).forEach(([meshId, record]) => {
    const normalized = GROUP_ALIASES[record.group];
    if (normalized && !groups[normalized].includes(meshId)) {
      groups[normalized].push(meshId);
    }
  });

  return groups;
}

function createPreset(
  id: string,
  variant: ConfiguratorAssemblyVariant,
  source: LabPresetJson,
  modules?: ConfiguratorModelPreset["modules"],
): ConfiguratorModelPreset {
  return {
    id,
    family: "PFI",
    variant,
    source,
    path: source.path,
    ...COMMON_TRANSFORM,
    camera: source.camera ?? FALLBACK_CAMERA,
    meshGroups: normalizeGroups(source),
    freeExtractions: source.freeExtractions ?? [],
    modules,
  };
}

export const PFI_ELECTRIC_TROLLEY_ELECTRIC_HOIST_PRESET = createPreset(
  "pfi-electric-trolley-electric-hoist",
  "electric-trolley-electric-hoist",
  ELECTRIC_ELECTRIC_PRESET,
);

export const PFI_MANUAL_TROLLEY_ELECTRIC_HOIST_PRESET = createPreset(
  "pfi-manual-trolley-electric-hoist",
  "manual-trolley-electric-hoist",
  MANUAL_ELECTRIC_PRESET,
  [
    {
      id: "electric-accessories",
      label: "Ligne d’alimentation et interrupteur",
      source: ELECTRIC_ELECTRIC_PRESET,
      groups: ["powerSupply", "mainSwitch"],
    },
  ],
);

export const PFI_MANUAL_TROLLEY_MANUAL_HOIST_PRESET = createPreset(
  "pfi-manual-trolley-manual-hoist",
  "manual-trolley-manual-hoist",
  MANUAL_MANUAL_PRESET,
  [
    {
      id: "electric-accessories",
      label: "Ligne d’alimentation et interrupteur",
      source: ELECTRIC_ELECTRIC_PRESET,
      groups: ["powerSupply", "mainSwitch"],
    },
  ],
);

export const PFI_PRODUCTION_PRESET =
  PFI_ELECTRIC_TROLLEY_ELECTRIC_HOIST_PRESET;
