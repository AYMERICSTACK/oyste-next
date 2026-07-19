export type ConfiguratorModelFamily =
  | "PFI"
  | "PFT"
  | "PMI"
  | "PMT"
  | "PMA"
  | "PMAM";

export type ConfiguratorAssemblyVariant =
  | "electric-trolley-electric-hoist"
  | "manual-trolley-electric-hoist"
  | "manual-trolley-manual-hoist";

export type ConfiguratorModuleGroup =
  | "structure"
  | "hoist"
  | "trolley"
  | "powerSupply"
  | "mainSwitch"
  | "ignore";

export type ConfiguratorCameraPreset = {
  position: readonly [number, number, number];
  target: readonly [number, number, number];
  fov: number;
  zoom: number;
};

export type ConfiguratorMeshGroups = Partial<
  Record<ConfiguratorModuleGroup, readonly string[]>
>;

export type LabFreeExtraction = {
  id: string;
  sourceMesh: string;
  name: string;
  group: string;
  indices: readonly number[];
  remainingName?: string;
  remainingGroup?: string;
  triangles: number;
  updatedAt: string;
};

export type LabPresetJson = {
  model: string;
  path: string;
  camera?: ConfiguratorCameraPreset;
  root: { id: string; name: string; protected: boolean };
  groups: Record<string, { label: string; meshes: readonly string[] }>;
  freeExtractions: readonly LabFreeExtraction[];
  validation?: {
    summary?: { total: number; validated: number; review: number };
    records?: Record<
      string,
      { status: string; group: string; note?: string; updatedAt?: string }
    >;
  };
  meshes?: readonly unknown[];
};

export type ConfiguratorModelModulePreset = {
  id: string;
  label: string;
  source: LabPresetJson;
  groups: readonly ConfiguratorModuleGroup[];
};

export type ConfiguratorModelPreset = {
  id: string;
  family: ConfiguratorModelFamily;
  variant: ConfiguratorAssemblyVariant;
  source: LabPresetJson;
  path: string;
  rotation: readonly [number, number, number];
  position: readonly [number, number, number];
  scale: number;
  camera?: ConfiguratorCameraPreset;
  meshGroups: ConfiguratorMeshGroups;
  freeExtractions: readonly LabFreeExtraction[];
  modules?: readonly ConfiguratorModelModulePreset[];
};

export type Configurator3DState = {
  craneType?: ConfiguratorModelFamily;
  capacity?: string;
  reach?: string;
  height?: string;
  fixing?: string;
  hoist?: string;
  hoistType?: string;
  trolleyMovement?: string;
  options: string[];
};
