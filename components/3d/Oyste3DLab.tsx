"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Canvas, useThree } from "@react-three/fiber";
import {
  ContactShadows,
  Environment,
  Html,
  OrbitControls,
  useGLTF,
} from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import {
  BadgeCheck,
  Box,
  Boxes,
  Check,
  CircleAlert,
  ChevronDown,
  ChevronUp,
  Copy,
  Cpu,
  Crosshair,
  Eye,
  EyeOff,
  Layers3,
  ListChecks,
  Maximize2,
  MousePointer2,
  RotateCcw,
  Save,
  ScanLine,
  Search,
  Settings2,
  ShieldCheck,
  ZoomIn,
} from "lucide-react";
import * as THREE from "three";

const PFI_MODEL_PATH = "/models/pfi-125-3-complete.glb";
const MESH_MAPPING_STORAGE_KEY = "oyste-3d-lab:pfi-125-3:mesh-mapping";
const DEV_PRESET_STORAGE_KEY = "oyste-3d-lab:pfi-125-3:developer-preset";
const EXTRACTION_PRESET_STORAGE_KEY =
  "oyste-3d-lab:pfi-125-3:mesh-022-extraction";
const MESH_VALIDATION_STORAGE_KEY = "oyste-3d-lab:pfi-125-3:mesh-validation";
const FREE_EXTRACTIONS_STORAGE_KEY = "oyste-3d-lab:pfi-125-3:free-extractions";

type ViewMode = "industrial" | "technical";
type Vector3Tuple = [number, number, number];

type ModelTransform = {
  rotation: Vector3Tuple;
  position: Vector3Tuple;
  scale: number;
};
type CameraPreset = {
  position: Vector3Tuple;
  target: Vector3Tuple;
  fov: number;
  zoom: number;
};
type LightSettings = {
  ambient: number;
  hemisphere: number;
  key: number;
  fill: number;
  exposure: number;
};
type ModelStats = {
  meshes: number;
  materials: number;
  width: number;
  height: number;
  depth: number;
  displayWidth: number;
  displayHeight: number;
  displayDepth: number;
};
type MeshDescriptor = {
  key: string;
  index: number;
  nodeName: string;
  meshName: string;
  materialName: string;
};
type MeshMapping = Record<string, string>;
type MeshValidationStatus = "pending" | "review" | "validated";
type MeshValidationGroup = FunctionalGroupId | "ignore" | "unassigned";
type MeshValidationRecord = {
  status: MeshValidationStatus;
  group: MeshValidationGroup;
  note: string;
  updatedAt: string;
};
type MeshValidationMap = Record<string, MeshValidationRecord>;
type IslandDescriptor = {
  key: string;
  index: number;
  triangles: number;
  width: number;
  height: number;
  depth: number;
};
type SurfaceSelectionInfo = {
  triangles: number;
  radius: number;
};
type SurfaceSelectionOperation = "add" | "subtract";
type ExtractionInfo = {
  extracted: boolean;
  triangles: number;
  name: string;
  stage: "idle" | "temporary" | "separated";
};
type ExtractionPreset = {
  version: 1;
  model: "PFI125_3_COMPLETE";
  sourceMesh: "mesh-022";
  stage: "draft" | "temporary" | "separated";
  temporaryTriangles: number[];
  arrowTriangles: number[];
  updatedAt: string;
};
type FreeExtractionRecord = {
  id: string;
  sourceMesh: string;
  name: string;
  group: FunctionalGroupId;
  indices: number[];
  triangles: number;
  remainingName?: string;
  remainingGroup?: FunctionalGroupId;
  updatedAt: string;
};
type FunctionalGroupId = "structure" | "hoist" | "powerSupply" | "mainSwitch";
type FunctionalGroup = {
  id: FunctionalGroupId;
  label: string;
  description: string;
  meshKeys: string[];
};

const ROOT_MESH_KEY = "mesh-001";
const REQUIRED_MESH_MAPPING: MeshMapping = {
  "mesh-025": "Interrupteur cadenassable",
};
const FUNCTIONAL_GROUPS: FunctionalGroup[] = [
  {
    id: "structure",
    label: "Structure",
    description: "Fût, flèche, pivot et éléments fixes de la potence",
    meshKeys: ["mesh-007", "mesh-009", "mesh-010", "mesh-022", "mesh-023"],
  },
  {
    id: "hoist",
    label: "Palan",
    description: "Palan complet, chariot et fin de course",
    meshKeys: [
      ROOT_MESH_KEY,
      "mesh-002",
      "mesh-004",
      "mesh-005",
      "mesh-006",
      "mesh-008",
      "mesh-012",
      "mesh-013",
      "mesh-014",
      "mesh-015",
      "mesh-016",
      "mesh-017",
      "mesh-018",
    ],
  },
  {
    id: "powerSupply",
    label: "Ligne d’alimentation",
    description: "Rail, câbles et accessoires d’alimentation",
    meshKeys: [
      "mesh-003",
      "mesh-019",
      "mesh-020",
      "mesh-021",
      "mesh-024",
      "mesh-027",
      "mesh-028",
    ],
  },
  {
    id: "mainSwitch",
    label: "Interrupteur cadenassable",
    description: "Sectionneur principal cadenassable fixé sur la potence",
    meshKeys: ["mesh-011", "mesh-025", "mesh-026"],
  },
];

const INITIAL_MODEL: ModelTransform = {
  rotation: [-180, 180, 180],
  position: [-0.4, -0.2, 0.25],
  scale: 1,
};
const INITIAL_CAMERA: CameraPreset = {
  position: [8, 5, 10],
  target: [0, 3, 0],
  fov: 38,
  zoom: 1,
};
const INITIAL_LIGHTS: LightSettings = {
  ambient: 1.05,
  hemisphere: 1.1,
  key: 3.2,
  fill: 0.9,
  exposure: 1,
};
const INITIAL_STATS: ModelStats = {
  meshes: 0,
  materials: 0,
  width: 0,
  height: 0,
  depth: 0,
  displayWidth: 0,
  displayHeight: 0,
  displayDepth: 0,
};

function round(value: number, digits = 4) {
  return Number(value.toFixed(digits));
}
function asTuple(vector: THREE.Vector3): Vector3Tuple {
  return [round(vector.x), round(vector.y), round(vector.z)];
}

function collectModelStats(scene: THREE.Object3D): ModelStats {
  let meshes = 0;
  const materials = new Set<string>();
  scene.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    meshes += 1;
    (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach(
      (material) => {
        if (material?.uuid) materials.add(material.uuid);
      },
    );
  });
  const size = new THREE.Vector3();
  new THREE.Box3().setFromObject(scene).getSize(size);
  return {
    meshes,
    materials: materials.size,
    width: size.x,
    height: size.y,
    depth: size.z,
    displayWidth: size.x,
    displayHeight: size.y,
    displayDepth: size.z,
  };
}

function prepareModel(
  scene: THREE.Object3D,
  viewMode: ViewMode,
  wireframe: boolean,
  shadows: boolean,
) {
  const cloned = scene.clone(true);
  cloned.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = shadows;
    mesh.receiveShadow = shadows;
    const prepared = (
      Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    ).map((material) => {
      const copy = material?.clone?.() as THREE.Material | undefined;
      if (!copy)
        return new THREE.MeshStandardMaterial({
          color: "#f59e0b",
          roughness: 0.72,
          metalness: 0.08,
          wireframe,
        });
      if (copy instanceof THREE.MeshStandardMaterial) {
        copy.roughness = viewMode === "industrial" ? 0.58 : 0.78;
        copy.metalness = Math.min(copy.metalness ?? 0, 0.35);
        copy.wireframe = wireframe;
        const dark =
          copy.color.r < 0.08 && copy.color.g < 0.08 && copy.color.b < 0.08;
        if (dark)
          copy.color.set(viewMode === "industrial" ? "#f59e0b" : "#cbd5e1");
      }
      return copy;
    });
    mesh.material = Array.isArray(mesh.material) ? prepared : prepared[0];
  });
  return cloned;
}

function splitGeometryIntoIslands(geometry: THREE.BufferGeometry) {
  const position = geometry.getAttribute("position");
  if (!position)
    return [] as { geometry: THREE.BufferGeometry; triangles: number }[];

  const index = geometry.getIndex();
  const triangleCount = index ? index.count / 3 : position.count / 3;
  const parent = new Int32Array(position.count);
  const rank = new Uint8Array(position.count);
  for (let i = 0; i < parent.length; i += 1) parent[i] = i;

  const find = (value: number) => {
    let current = value;
    while (parent[current] !== current) {
      parent[current] = parent[parent[current]];
      current = parent[current];
    }
    return current;
  };
  const union = (a: number, b: number) => {
    let rootA = find(a);
    let rootB = find(b);
    if (rootA === rootB) return;
    if (rank[rootA] < rank[rootB]) [rootA, rootB] = [rootB, rootA];
    parent[rootB] = rootA;
    if (rank[rootA] === rank[rootB]) rank[rootA] += 1;
  };
  const vertexAt = (offset: number) => (index ? index.getX(offset) : offset);

  for (let triangle = 0; triangle < triangleCount; triangle += 1) {
    const offset = triangle * 3;
    const a = vertexAt(offset);
    const b = vertexAt(offset + 1);
    const c = vertexAt(offset + 2);
    union(a, b);
    union(b, c);
  }

  const componentIndices = new Map<number, number[]>();
  for (let triangle = 0; triangle < triangleCount; triangle += 1) {
    const offset = triangle * 3;
    const a = vertexAt(offset);
    const root = find(a);
    const values = componentIndices.get(root) ?? [];
    values.push(vertexAt(offset), vertexAt(offset + 1), vertexAt(offset + 2));
    componentIndices.set(root, values);
  }

  return [...componentIndices.values()]
    .map((indices) => {
      const islandGeometry = geometry.clone();
      islandGeometry.setIndex(indices);
      islandGeometry.computeBoundingBox();
      islandGeometry.computeBoundingSphere();
      return { geometry: islandGeometry, triangles: indices.length / 3 };
    })
    .sort((a, b) => b.triangles - a.triangles);
}

function getTrianglesWithinRadius(
  geometry: THREE.BufferGeometry,
  localPoint: THREE.Vector3,
  localRadius: number,
) {
  const position = geometry.getAttribute("position");
  if (!position) return [] as number[];

  const index = geometry.getIndex();
  const triangleCount = index ? index.count / 3 : position.count / 3;
  const matches: number[] = [];
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const centroid = new THREE.Vector3();
  const vertexAt = (offset: number) => (index ? index.getX(offset) : offset);

  for (let triangle = 0; triangle < triangleCount; triangle += 1) {
    const offset = triangle * 3;
    const ia = vertexAt(offset);
    const ib = vertexAt(offset + 1);
    const ic = vertexAt(offset + 2);
    a.fromBufferAttribute(position, ia);
    b.fromBufferAttribute(position, ib);
    c.fromBufferAttribute(position, ic);
    centroid
      .copy(a)
      .add(b)
      .add(c)
      .multiplyScalar(1 / 3);
    if (centroid.distanceTo(localPoint) <= localRadius) matches.push(triangle);
  }

  return matches;
}

function buildGeometryFromTriangleSelection(
  geometry: THREE.BufferGeometry,
  selectedTriangles: Set<number>,
) {
  const position = geometry.getAttribute("position");
  if (!position)
    return { geometry: null, triangles: 0, selected: [], remaining: [] };

  const index = geometry.getIndex();
  const triangleCount = index ? index.count / 3 : position.count / 3;
  const selected: number[] = [];
  const remaining: number[] = [];
  const vertexAt = (offset: number) => (index ? index.getX(offset) : offset);

  for (let triangle = 0; triangle < triangleCount; triangle += 1) {
    const offset = triangle * 3;
    const target = selectedTriangles.has(triangle) ? selected : remaining;
    target.push(vertexAt(offset), vertexAt(offset + 1), vertexAt(offset + 2));
  }

  if (!selected.length)
    return { geometry: null, triangles: 0, selected, remaining };

  const result = geometry.clone();
  result.setIndex(selected);
  result.computeVertexNormals();
  result.computeBoundingBox();
  result.computeBoundingSphere();

  return {
    geometry: result,
    triangles: selected.length / 3,
    selected,
    remaining,
  };
}

function PfiModel({
  viewMode,
  hiddenMeshes,
  isolatedMesh,
  isolatedGroup,
  transform,
  wireframe,
  shadows,
  onStats,
  onMeshes,
  onFocusPoint,
  hiddenIslands,
  isolatedIsland,
  onIslands,
  surfaceSelectionMode,
  surfaceSelectionRadius,
  surfaceSelectionPoint,
  surfaceSelectionFaceIndex,
  surfaceSelectionActionKey,
  surfaceSelectionOperation,
  invertSelectionKey,
  clearSelectionKey,
  undoSelectionKey,
  onSurfacePoint,
  onSurfaceSelection,
  extractSelectionKey,
  finalizeSeparationKey,
  resetExtractionKey,
  onExtraction,
  freeExtractionKey,
  freeExtractionName,
  freeExtractionGroup,
  freeExtractionSourceMesh,
  freeExtractionRemainingName,
  freeExtractionRemainingGroup,
  functionalGroups,
  resetFreeExtractionsKey,
  onFreeExtraction,
}: {
  viewMode: ViewMode;
  hiddenMeshes: Set<string>;
  isolatedMesh: string | null;
  isolatedGroup: FunctionalGroupId | null;
  transform: ModelTransform;
  wireframe: boolean;
  shadows: boolean;
  onStats: (stats: ModelStats) => void;
  onMeshes: (meshes: MeshDescriptor[]) => void;
  onFocusPoint: (point: Vector3Tuple) => void;
  hiddenIslands: Set<string>;
  isolatedIsland: string | null;
  onIslands: (islands: IslandDescriptor[]) => void;
  surfaceSelectionMode: boolean;
  surfaceSelectionRadius: number;
  surfaceSelectionPoint: Vector3Tuple | null;
  surfaceSelectionFaceIndex: number | null;
  surfaceSelectionActionKey: number;
  surfaceSelectionOperation: SurfaceSelectionOperation;
  invertSelectionKey: number;
  clearSelectionKey: number;
  undoSelectionKey: number;
  onSurfacePoint: (
    point: Vector3Tuple,
    faceIndex: number | null,
    meshKey: string,
  ) => void;
  onSurfaceSelection: (info: SurfaceSelectionInfo) => void;
  extractSelectionKey: number;
  finalizeSeparationKey: number;
  resetExtractionKey: number;
  onExtraction: (info: ExtractionInfo) => void;
  freeExtractionKey: number;
  freeExtractionName: string;
  freeExtractionGroup: FunctionalGroupId;
  freeExtractionSourceMesh: string;
  freeExtractionRemainingName: string;
  freeExtractionRemainingGroup: FunctionalGroupId;
  functionalGroups: FunctionalGroup[];
  resetFreeExtractionsKey: number;
  onFreeExtraction: (record: FreeExtractionRecord | null) => void;
}) {
  const { scene } = useGLTF(PFI_MODEL_PATH);
  const { camera, gl } = useThree();
  const [selectedTriangles, setSelectedTriangles] = useState<Set<number>>(
    () => new Set(),
  );
  const [surfaceSelectionMeshKey, setSurfaceSelectionMeshKey] = useState(
    freeExtractionSourceMesh,
  );
  const selectionHistoryRef = useRef<Set<number>[]>([]);
  const temporarySelectionRef = useRef<Set<number>>(new Set());
  const restoredExtractionRef = useRef(false);
  const restoredFreeExtractionsRef = useRef(false);
  const [extractionRestoreReady, setExtractionRestoreReady] = useState(false);
  const [editingTemporaryMesh, setEditingTemporaryMesh] = useState(false);
  const { model, normalizedScale, stats, meshes, islands, sourceMesh022 } =
    useMemo(() => {
      const prepared = prepareModel(scene, viewMode, wireframe, shadows);
      const descriptors: MeshDescriptor[] = [];
      let meshIndex = 0;
      prepared.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (!mesh.isMesh) return;
        meshIndex += 1;
        const key = `mesh-${String(meshIndex).padStart(3, "0")}`;
        const material = Array.isArray(mesh.material)
          ? mesh.material[0]
          : mesh.material;
        mesh.userData.oysteMeshKey = key;
        mesh.geometry = mesh.geometry.clone();
        mesh.userData.oysteOriginalGeometry = mesh.geometry.clone();
        if (key === ROOT_MESH_KEY) {
          // The root mesh owns visible geometry as well as the complete child hierarchy.
          // Clone only its geometry so drawRange can be changed without mutating the
          // GLTF cache or another viewer instance.
          mesh.geometry = mesh.geometry.clone();
          mesh.userData.oysteOriginalDrawRange = {
            start: mesh.geometry.drawRange.start,
            count: mesh.geometry.drawRange.count,
          };
        }
        descriptors.push({
          key,
          index: meshIndex,
          nodeName: mesh.parent?.name || "Sans parent",
          meshName: mesh.name || `Mesh ${meshIndex}`,
          materialName: material?.name || "Sans nom",
        });
      });

      const islandDescriptors: IslandDescriptor[] = [];
      let mesh022: THREE.Mesh | null = null;
      prepared.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (mesh.isMesh && mesh.userData.oysteMeshKey === "mesh-022")
          mesh022 = mesh;
      });
      const source = mesh022 as THREE.Mesh | null;
      if (source?.parent) {
        const islandGroup = new THREE.Group();
        islandGroup.name = "mesh-022-islands";
        islandGroup.position.copy(source.position);
        islandGroup.quaternion.copy(source.quaternion);
        islandGroup.scale.copy(source.scale);
        const sourceMaterials = Array.isArray(source.material)
          ? source.material
          : [source.material];
        splitGeometryIntoIslands(source.geometry).forEach((island, index) => {
          const key = `mesh-022-island-${String(index + 1).padStart(3, "0")}`;
          const islandMesh = new THREE.Mesh(
            island.geometry,
            sourceMaterials.map((material) => material.clone()),
          );
          islandMesh.userData.oysteIslandKey = key;
          islandMesh.userData.oysteParentMeshKey = "mesh-022";
          islandMesh.castShadow = source.castShadow;
          islandMesh.receiveShadow = source.receiveShadow;
          const size = new THREE.Vector3();
          island.geometry.boundingBox?.getSize(size);
          islandDescriptors.push({
            key,
            index: index + 1,
            triangles: island.triangles,
            width: size.x,
            height: size.y,
            depth: size.z,
          });
          islandGroup.add(islandMesh);
        });
        // Keep the original mesh-022 visible in the normal 3D Lab view.
        // The generated islands are debug helpers only and must never replace
        // the production geometry automatically at startup.
        source.parent.add(islandGroup);
      }

      const group = new THREE.Group();
      const [rx, ry, rz] = transform.rotation.map(
        THREE.MathUtils.degToRad,
      ) as Vector3Tuple;
      prepared.rotation.set(rx, ry, rz);
      group.add(prepared);
      group.updateMatrixWorld(true);
      const rawStats = collectModelStats(scene);
      const box = new THREE.Box3().setFromObject(group);
      const size = new THREE.Vector3();
      const center = new THREE.Vector3();
      box.getSize(size);
      box.getCenter(center);
      const baseScale = 6.2 / Math.max(size.x, size.y, size.z, 1);
      group.position.set(-center.x, -box.min.y, -center.z);
      group.updateMatrixWorld(true);
      return {
        model: group,
        normalizedScale: baseScale,
        meshes: descriptors,
        islands: islandDescriptors,
        sourceMesh022: source,
        stats: {
          ...rawStats,
          displayWidth: size.x * baseScale * transform.scale,
          displayHeight: size.y * baseScale * transform.scale,
          displayDepth: size.z * baseScale * transform.scale,
        },
      };
    }, [
      scene,
      shadows,
      transform.rotation,
      transform.scale,
      viewMode,
      wireframe,
    ]);

  const findMeshByKey = useCallback(
    (key: string): THREE.Mesh | null => {
      let found: THREE.Mesh | null = null;
      model.traverse((object) => {
        if (found || !(object instanceof THREE.Mesh)) return;
        if (object.userData.oysteMeshKey === key) found = object;
      });
      // TypeScript does not track assignments performed inside Object3D.traverse.
      // Keep the public return type explicit so callers retain THREE.Mesh narrowing.
      return found as THREE.Mesh | null;
    },
    [model],
  );

  const saveExtractionPreset = useCallback(
    (
      preset: Omit<
        ExtractionPreset,
        "version" | "model" | "sourceMesh" | "updatedAt"
      >,
    ) => {
      try {
        const payload: ExtractionPreset = {
          version: 1,
          model: "PFI125_3_COMPLETE",
          sourceMesh: "mesh-022",
          ...preset,
          updatedAt: new Date().toISOString(),
        };
        localStorage.setItem(
          EXTRACTION_PRESET_STORAGE_KEY,
          JSON.stringify(payload),
        );
      } catch {
        /* local persistence must never block the 3D Lab */
      }
    },
    [],
  );

  const createTemporaryMesh = useCallback(
    (source: THREE.Mesh, selectedTrianglesToExtract: Set<number>) => {
      const original = source.userData.oysteOriginalGeometry as
        THREE.BufferGeometry | undefined;
      if (!original || !source.parent) return null;

      const selected = buildGeometryFromTriangleSelection(
        original,
        selectedTrianglesToExtract,
      );
      if (!selected.geometry || !selected.remaining.length) return null;

      const remainingGeometry = original.clone();
      remainingGeometry.setIndex(selected.remaining);
      remainingGeometry.computeVertexNormals();
      remainingGeometry.computeBoundingBox();
      remainingGeometry.computeBoundingSphere();
      source.geometry.dispose();
      source.geometry = remainingGeometry;

      const temporaryMesh = new THREE.Mesh(selected.geometry, source.material);
      temporaryMesh.name = "mesh-022-temporary-extracted";
      temporaryMesh.userData.oysteMeshKey = "mesh-022-temporary";
      temporaryMesh.userData.oysteTemporaryEditor = true;
      temporaryMesh.position.copy(source.position);
      temporaryMesh.quaternion.copy(source.quaternion);
      temporaryMesh.scale.copy(source.scale);
      temporaryMesh.castShadow = source.castShadow;
      temporaryMesh.receiveShadow = source.receiveShadow;
      source.parent.add(temporaryMesh);

      return { temporaryMesh, triangles: selected.triangles };
    },
    [],
  );

  const finalizeTemporaryMesh = useCallback(
    (
      source: THREE.Mesh,
      temporaryMesh: THREE.Mesh,
      arrowTriangles: Set<number>,
    ) => {
      if (!source.parent) return null;
      const split = buildGeometryFromTriangleSelection(
        temporaryMesh.geometry,
        arrowTriangles,
      );
      if (!split.geometry || !split.remaining.length) return null;

      const traverseGeometry = temporaryMesh.geometry.clone();
      traverseGeometry.setIndex(split.remaining);
      traverseGeometry.computeVertexNormals();
      traverseGeometry.computeBoundingBox();
      traverseGeometry.computeBoundingSphere();

      const arrowMesh = new THREE.Mesh(split.geometry, temporaryMesh.material);
      arrowMesh.name = "mesh-022-arrow-restored";
      arrowMesh.userData.oysteExtractedGroup = "structure";
      arrowMesh.userData.oysteMeshKey = "mesh-022-arrow-restored";
      arrowMesh.position.copy(temporaryMesh.position);
      arrowMesh.quaternion.copy(temporaryMesh.quaternion);
      arrowMesh.scale.copy(temporaryMesh.scale);
      arrowMesh.castShadow = temporaryMesh.castShadow;
      arrowMesh.receiveShadow = temporaryMesh.receiveShadow;

      const traverseMesh = new THREE.Mesh(
        traverseGeometry,
        temporaryMesh.material,
      );
      traverseMesh.name = "mesh-022-traverse-extracted";
      traverseMesh.userData.oysteExtractedGroup = "hoist";
      traverseMesh.userData.oysteMeshKey = "mesh-022-traverse";
      traverseMesh.position.copy(temporaryMesh.position);
      traverseMesh.quaternion.copy(temporaryMesh.quaternion);
      traverseMesh.scale.copy(temporaryMesh.scale);
      traverseMesh.castShadow = temporaryMesh.castShadow;
      traverseMesh.receiveShadow = temporaryMesh.receiveShadow;

      source.parent.remove(temporaryMesh);
      temporaryMesh.geometry.dispose();
      source.parent.add(arrowMesh);
      source.parent.add(traverseMesh);

      return { traverseTriangles: split.remaining.length / 3 };
    },
    [],
  );

  useEffect(() => {
    if (!sourceMesh022?.parent || restoredExtractionRef.current) return;
    restoredExtractionRef.current = true;

    try {
      // Free extractions are now the canonical reconstruction recipe.
      // When at least one exists, do not replay the old mesh-022-specific
      // preset first: it would mutate the source geometry before the generic
      // reconstruction engine and make saved triangle signatures invalid.
      const freeRaw = localStorage.getItem(FREE_EXTRACTIONS_STORAGE_KEY);
      const freeRecords = freeRaw
        ? (JSON.parse(freeRaw) as FreeExtractionRecord[])
        : [];
      if (freeRecords.length) return;

      const raw = localStorage.getItem(EXTRACTION_PRESET_STORAGE_KEY);
      if (!raw) return;
      const preset = JSON.parse(raw) as ExtractionPreset;
      if (
        preset.version !== 1 ||
        preset.model !== "PFI125_3_COMPLETE" ||
        preset.sourceMesh !== "mesh-022"
      )
        return;

      const temporaryTriangles = new Set(preset.temporaryTriangles ?? []);
      temporarySelectionRef.current = temporaryTriangles;

      if (preset.stage === "draft") {
        setSelectedTriangles(temporaryTriangles);
        return;
      }

      const temporary = createTemporaryMesh(sourceMesh022, temporaryTriangles);
      if (!temporary) return;

      if (preset.stage === "temporary") {
        const arrowTriangles = new Set(preset.arrowTriangles ?? []);
        setEditingTemporaryMesh(true);
        setSelectedTriangles(arrowTriangles);
        onExtraction({
          extracted: true,
          triangles: temporary.triangles,
          name: "Zone temporaire restaurée",
          stage: "temporary",
        });
        return;
      }

      const arrowTriangles = new Set(preset.arrowTriangles ?? []);
      const finalized = finalizeTemporaryMesh(
        sourceMesh022,
        temporary.temporaryMesh,
        arrowTriangles,
      );
      if (!finalized) return;
      setEditingTemporaryMesh(false);
      setSelectedTriangles(new Set());
      onExtraction({
        extracted: true,
        triangles: finalized.traverseTriangles,
        name: "Traverse porte-palan restaurée",
        stage: "separated",
      });
    } catch {
      /* invalid saved extraction is ignored safely */
    } finally {
      setExtractionRestoreReady(true);
    }
  }, [createTemporaryMesh, finalizeTemporaryMesh, onExtraction, sourceMesh022]);

  useEffect(() => {
    if (!sourceMesh022 || restoredExtractionRef.current === false) return;
    try {
      const currentRaw = localStorage.getItem(EXTRACTION_PRESET_STORAGE_KEY);
      const current = currentRaw
        ? (JSON.parse(currentRaw) as ExtractionPreset)
        : null;
      if (current?.stage === "separated") return;

      if (editingTemporaryMesh) {
        saveExtractionPreset({
          stage: "temporary",
          temporaryTriangles: [...temporarySelectionRef.current],
          arrowTriangles: [...selectedTriangles],
        });
      } else {
        saveExtractionPreset({
          stage: "draft",
          temporaryTriangles: [...selectedTriangles],
          arrowTriangles: [],
        });
      }
    } catch {
      /* selection autosave must never block editing */
    }
  }, [
    editingTemporaryMesh,
    saveExtractionPreset,
    selectedTriangles,
  ]);

  const applyFreeExtraction = useCallback(
    (record: FreeExtractionRecord) => {
      const sourceMesh = findMeshByKey(record.sourceMesh);
      if (!sourceMesh?.parent || !record.indices.length) return false;
      const geometry = sourceMesh.geometry;
      const position = geometry.getAttribute("position");
      if (!position) return false;
      const index = geometry.getIndex();
      const triangleCount = index ? index.count / 3 : position.count / 3;
      const selectedSignatures = new Set<string>();
      for (let offset = 0; offset < record.indices.length; offset += 3) {
        selectedSignatures.add(
          `${record.indices[offset]}:${record.indices[offset + 1]}:${record.indices[offset + 2]}`,
        );
      }
      const selected: number[] = [];
      const remaining: number[] = [];
      const vertexAt = (offset: number) => (index ? index.getX(offset) : offset);
      for (let triangle = 0; triangle < triangleCount; triangle += 1) {
        const offset = triangle * 3;
        const a = vertexAt(offset);
        const b = vertexAt(offset + 1);
        const c = vertexAt(offset + 2);
        const target = selectedSignatures.has(`${a}:${b}:${c}`)
          ? selected
          : remaining;
        target.push(a, b, c);
      }
      if (!selected.length || !remaining.length) return false;

      // Keep metadata aligned with the geometry actually reconstructed. This
      // also migrates older records whose UI triangle count was saved before
      // the final extraction geometry had been calculated.
      record.triangles = selected.length / 3;

      const parent = sourceMesh.parent;
      const extractedGeometry = geometry.clone();
      extractedGeometry.setIndex(selected);
      extractedGeometry.computeVertexNormals();
      extractedGeometry.computeBoundingBox();
      extractedGeometry.computeBoundingSphere();

      const remainingGeometry = geometry.clone();
      remainingGeometry.setIndex(remaining);
      remainingGeometry.computeVertexNormals();
      remainingGeometry.computeBoundingBox();
      remainingGeometry.computeBoundingSphere();
      sourceMesh.geometry.dispose();
      sourceMesh.geometry = remainingGeometry;
      sourceMesh.userData.oysteDynamicGroup = record.remainingGroup;
      sourceMesh.userData.oysteRemainingName = record.remainingName;

      const extractedMesh = new THREE.Mesh(
        extractedGeometry,
        Array.isArray(sourceMesh.material)
          ? sourceMesh.material.map((material) => material.clone())
          : sourceMesh.material.clone(),
      );
      extractedMesh.name = record.id;
      extractedMesh.userData.oysteMeshKey = record.id;
      extractedMesh.userData.oysteExtractedGroup = record.group;
      extractedMesh.userData.oysteFreeExtraction = true;
      extractedMesh.userData.oysteSourceMesh = record.sourceMesh;
      extractedMesh.position.copy(sourceMesh.position);
      extractedMesh.quaternion.copy(sourceMesh.quaternion);
      extractedMesh.scale.copy(sourceMesh.scale);
      extractedMesh.castShadow = sourceMesh.castShadow;
      extractedMesh.receiveShadow = sourceMesh.receiveShadow;
      parent.add(extractedMesh);
      return true;
    },
    [findMeshByKey],
  );

  const rebuildFreeExtractions = useCallback(
    (records: FreeExtractionRecord[]) => {
      // 1. Remove every generated extraction from the current scene.
      const generated: THREE.Mesh[] = [];
      model.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (mesh.isMesh && mesh.userData.oysteFreeExtraction) {
          generated.push(mesh);
        }
      });
      generated.forEach((mesh) => {
        mesh.parent?.remove(mesh);
        mesh.geometry.dispose();
        (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach(
          (material) => material?.dispose?.(),
        );
      });

      // 2. Restore each affected source mesh from the immutable GLB geometry.
      const sourceKeys = [...new Set(records.map((record) => record.sourceMesh))];
      sourceKeys.forEach((sourceKey) => {
        const sourceMesh = findMeshByKey(sourceKey);
        const original = sourceMesh?.userData.oysteOriginalGeometry as
          | THREE.BufferGeometry
          | undefined;
        if (!sourceMesh || !original) return;
        sourceMesh.geometry.dispose();
        sourceMesh.geometry = original.clone();
        delete sourceMesh.userData.oysteDynamicGroup;
        delete sourceMesh.userData.oysteRemainingName;
      });

      // 3. Replay the saved recipe in creation order. Because every record stores
      // vertex-index signatures, successive cuts remain stable on the remaining
      // indexed geometry and no triangle numbering drift can occur.
      const ordered = [...records].sort((a, b) =>
        a.updatedAt.localeCompare(b.updatedAt),
      );
      const applied: FreeExtractionRecord[] = [];
      const failed: FreeExtractionRecord[] = [];
      ordered.forEach((record) => {
        if (applyFreeExtraction(record)) applied.push(record);
        else failed.push(record);
      });

      model.updateMatrixWorld(true);
      try {
        localStorage.setItem(
          FREE_EXTRACTIONS_STORAGE_KEY,
          JSON.stringify(ordered),
        );
      } catch {
        /* rebuilt geometry remains usable even if persistence is unavailable */
      }
      return { applied, failed };
    },
    [applyFreeExtraction, findMeshByKey, model],
  );

  useEffect(() => {
    if (!extractionRestoreReady || restoredFreeExtractionsRef.current) return;
    restoredFreeExtractionsRef.current = true;
    try {
      const raw = localStorage.getItem(FREE_EXTRACTIONS_STORAGE_KEY);
      const records = raw ? (JSON.parse(raw) as FreeExtractionRecord[]) : [];
      const { applied } = rebuildFreeExtractions(records);
      onFreeExtraction(applied.at(-1) ?? null);
    } catch {
      /* invalid free extraction preset is ignored safely */
    }
  }, [
    extractionRestoreReady,
    onFreeExtraction,
    rebuildFreeExtractions,
  ]);

  useEffect(() => {
    if (
      !freeExtractionKey ||
      editingTemporaryMesh ||
      !freeExtractionName.trim()
    )
      return;
    const sourceMesh = findMeshByKey(freeExtractionSourceMesh);
    if (!sourceMesh?.parent) return;
    const selected = buildGeometryFromTriangleSelection(
      sourceMesh.geometry,
      selectedTriangles,
    );
    if (!selected.geometry || !selected.remaining.length) return;
    const slug =
      freeExtractionName
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") || "piece";
    const record: FreeExtractionRecord = {
      id: `${freeExtractionSourceMesh}-extracted-${slug}`,
      sourceMesh: freeExtractionSourceMesh,
      name: freeExtractionName.trim(),
      group: freeExtractionGroup,
      indices: selected.selected,
      remainingName: freeExtractionRemainingName.trim() || undefined,
      remainingGroup: freeExtractionRemainingGroup,
      triangles: selected.triangles,
      updatedAt: new Date().toISOString(),
    };
    let nextRecords: FreeExtractionRecord[] = [];
    try {
      const raw = localStorage.getItem(FREE_EXTRACTIONS_STORAGE_KEY);
      const records = raw ? (JSON.parse(raw) as FreeExtractionRecord[]) : [];
      nextRecords = [
        ...records.filter((item) => item.id !== record.id),
        record,
      ];
      localStorage.setItem(
        FREE_EXTRACTIONS_STORAGE_KEY,
        JSON.stringify(nextRecords),
      );
    } catch {
      /* storage failure must never block extraction */
      return;
    }

    const rebuilt = rebuildFreeExtractions(nextRecords);
    if (!rebuilt.applied.some((item) => item.id === record.id)) return;
    selectionHistoryRef.current = [];
    setSelectedTriangles(new Set());
    onFreeExtraction(record);
  }, [
    editingTemporaryMesh,
    findMeshByKey,
    freeExtractionGroup,
    freeExtractionKey,
    freeExtractionName,
    freeExtractionRemainingGroup,
    freeExtractionRemainingName,
    freeExtractionSourceMesh,
    onFreeExtraction,
    rebuildFreeExtractions,
    selectedTriangles,
    sourceMesh022,
  ]);

  useEffect(() => {
    if (!resetFreeExtractionsKey || !sourceMesh022?.parent) return;
    try {
      localStorage.removeItem(FREE_EXTRACTIONS_STORAGE_KEY);
    } catch {
      /* storage cleanup is best effort */
    }
    sourceMesh022.parent.children
      .filter((child) => child.userData?.oysteFreeExtraction)
      .forEach((child) => {
        sourceMesh022.parent?.remove(child);
        (child as THREE.Mesh).geometry.dispose();
      });
    window.location.reload();
  }, [resetFreeExtractionsKey, sourceMesh022]);

  useEffect(() => {
    model.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      const extractedGroup = mesh.userData.oysteExtractedGroup as
        FunctionalGroupId | undefined;
      if (extractedGroup) {
        const extractedKey = mesh.userData.oysteMeshKey as string | undefined;
        const groupDefinition = functionalGroups.find(
          (group) => group.id === extractedGroup,
        );
        const groupHidden =
          Boolean(extractedKey && hiddenMeshes.has(extractedKey)) ||
          Boolean(
            groupDefinition &&
            groupDefinition.meshKeys.every((key) => hiddenMeshes.has(key)),
          );
        mesh.visible = isolatedMesh
          ? isolatedMesh === extractedKey
          : isolatedGroup
            ? isolatedGroup === extractedGroup
            : !groupHidden;
        return;
      }
      const islandKey = mesh.userData.oysteIslandKey as string | undefined;
      if (islandKey) {
        // Islands are only rendered while explicitly inspecting one of them.
        // Otherwise the untouched mesh-022 remains the single source of truth.
        mesh.visible = isolatedIsland === islandKey;
        return;
      }
      const key = mesh.userData.oysteMeshKey as string | undefined;
      if (!key) return;
      const dynamicGroup = mesh.userData.oysteDynamicGroup as FunctionalGroupId | undefined;
      if (dynamicGroup) {
        const definition = functionalGroups.find((group) => group.id === dynamicGroup);
        const groupHidden = Boolean(
          definition && definition.meshKeys.every((meshKey) => hiddenMeshes.has(meshKey)),
        );
        mesh.visible = isolatedMesh
          ? isolatedMesh === key
          : isolatedGroup
            ? isolatedGroup === dynamicGroup
            : !hiddenMeshes.has(key) && !groupHidden;
        return;
      }
      if (isolatedIsland) {
        mesh.visible = false;
        return;
      }
      const isolatedGroupKeys = isolatedGroup
        ? (functionalGroups.find((group) => group.id === isolatedGroup)
            ?.meshKeys ?? [])
        : null;

      if (key === ROOT_MESH_KEY) {
        // mesh-001 is both the hierarchy root and a visible part of the hoist.
        // Keep the node active so its children remain renderable, but toggle only
        // its own cloned material to hide/show the geometry independently.
        mesh.visible = true;
        const showRootGeometry = isolatedMesh
          ? false
          : isolatedGroupKeys
            ? isolatedGroupKeys.includes(ROOT_MESH_KEY)
            : !hiddenMeshes.has(ROOT_MESH_KEY);
        const rootMaterials = Array.isArray(mesh.material)
          ? mesh.material
          : [mesh.material];
        rootMaterials.forEach((material) => {
          if (material) material.visible = showRootGeometry;
        });

        // Some STEP → GLB exports keep several visible parts inside the root
        // geometry itself. drawRange is the reliable way to hide every triangle
        // belonging to mesh-001 while preserving its children.
        const originalDrawRange = mesh.userData.oysteOriginalDrawRange as
          { start: number; count: number } | undefined;
        if (showRootGeometry) {
          mesh.geometry.setDrawRange(
            originalDrawRange?.start ?? 0,
            originalDrawRange?.count ?? Infinity,
          );
        } else {
          mesh.geometry.setDrawRange(0, 0);
        }
        return;
      }

      mesh.visible = isolatedMesh
        ? key === isolatedMesh
        : isolatedGroupKeys
          ? isolatedGroupKeys.includes(key)
          : !hiddenMeshes.has(key);
    });
  }, [
    hiddenIslands,
    functionalGroups,
    hiddenMeshes,
    isolatedGroup,
    isolatedIsland,
    isolatedMesh,
    model,
  ]);
  useEffect(() => {
    setSurfaceSelectionMeshKey(freeExtractionSourceMesh);
    selectionHistoryRef.current = [];
    setSelectedTriangles(new Set());
    onSurfaceSelection({ triangles: 0, radius: surfaceSelectionRadius });
  }, [freeExtractionSourceMesh, onSurfaceSelection, surfaceSelectionRadius]);

  useEffect(() => {
    if (!surfaceSelectionActionKey || !surfaceSelectionPoint) return;

    const editableMesh = editingTemporaryMesh
      ? (sourceMesh022?.parent?.getObjectByName(
          "mesh-022-temporary-extracted",
        ) as THREE.Mesh | undefined)
      : findMeshByKey(surfaceSelectionMeshKey);
    if (!editableMesh) return;

    editableMesh.updateWorldMatrix(true, false);
    const localPoint = editableMesh.worldToLocal(
      new THREE.Vector3(...surfaceSelectionPoint),
    );
    const worldScale = new THREE.Vector3();
    editableMesh.getWorldScale(worldScale);
    const scale = Math.max(
      (worldScale.x + worldScale.y + worldScale.z) / 3,
      1e-6,
    );
    const localRadius = surfaceSelectionRadius / scale;
    const triangles = getTrianglesWithinRadius(
      editableMesh.geometry,
      localPoint,
      localRadius,
    );
    if (
      surfaceSelectionFaceIndex !== null &&
      surfaceSelectionFaceIndex >= 0 &&
      !triangles.includes(surfaceSelectionFaceIndex)
    ) {
      triangles.push(surfaceSelectionFaceIndex);
    }

    setSelectedTriangles((current) => {
      selectionHistoryRef.current.push(new Set(current));
      if (selectionHistoryRef.current.length > 30)
        selectionHistoryRef.current.shift();

      const next = new Set(current);
      triangles.forEach((triangle) => {
        if (surfaceSelectionOperation === "add") next.add(triangle);
        else next.delete(triangle);
      });
      return next;
    });
  }, [
    editingTemporaryMesh,
    findMeshByKey,
    freeExtractionSourceMesh,
    model,
    sourceMesh022,
    surfaceSelectionMeshKey,
    surfaceSelectionFaceIndex,
    surfaceSelectionActionKey,
    surfaceSelectionOperation,
    surfaceSelectionPoint,
    surfaceSelectionRadius,
  ]);

  useEffect(() => {
    if (!invertSelectionKey || !sourceMesh022) return;
    const editableMesh = editingTemporaryMesh
      ? (sourceMesh022.parent?.getObjectByName(
          "mesh-022-temporary-extracted",
        ) as THREE.Mesh | undefined)
      : findMeshByKey(freeExtractionSourceMesh);
    if (!editableMesh) return;
    const position = editableMesh.geometry.getAttribute("position");
    if (!position) return;
    const index = editableMesh.geometry.getIndex();
    const triangleCount = index ? index.count / 3 : position.count / 3;

    setSelectedTriangles((current) => {
      selectionHistoryRef.current.push(new Set(current));
      const next = new Set<number>();
      for (let triangle = 0; triangle < triangleCount; triangle += 1) {
        if (!current.has(triangle)) next.add(triangle);
      }
      return next;
    });
  }, [editingTemporaryMesh, findMeshByKey, freeExtractionSourceMesh, invertSelectionKey, sourceMesh022]);

  useEffect(() => {
    if (!clearSelectionKey) return;
    setSelectedTriangles((current) => {
      selectionHistoryRef.current.push(new Set(current));
      return new Set();
    });
  }, [clearSelectionKey]);

  useEffect(() => {
    if (!undoSelectionKey) return;
    const previous = selectionHistoryRef.current.pop();
    if (previous) setSelectedTriangles(new Set(previous));
  }, [undoSelectionKey]);

  useEffect(() => {
    if (!sourceMesh022?.parent) return;
    const editableMesh = editingTemporaryMesh
      ? (sourceMesh022.parent.getObjectByName(
          "mesh-022-temporary-extracted",
        ) as THREE.Mesh | undefined)
      : findMeshByKey(surfaceSelectionMeshKey);
    if (!editableMesh?.parent) return;
    const parent = editableMesh.parent;
    const previous = parent.getObjectByName("oyste-surface-selection");
    if (previous) {
      parent.remove(previous);
      const previousMesh = previous as THREE.Mesh;
      previousMesh.geometry?.dispose?.();
      (Array.isArray(previousMesh.material)
        ? previousMesh.material
        : [previousMesh.material]
      ).forEach((material) => material?.dispose?.());
    }

    const selected = buildGeometryFromTriangleSelection(
      editableMesh.geometry,
      selectedTriangles,
    );
    onSurfaceSelection({
      triangles: selected.triangles,
      radius: surfaceSelectionRadius,
    });
    if (!selected.geometry) return;

    const highlight = new THREE.Mesh(
      selected.geometry,
      new THREE.MeshBasicMaterial({
        color: "#f43f5e",
        transparent: true,
        opacity: 0.78,
        depthTest: false,
        side: THREE.DoubleSide,
      }),
    );
    highlight.name = "oyste-surface-selection";
    highlight.position.copy(editableMesh.position);
    highlight.quaternion.copy(editableMesh.quaternion);
    highlight.scale.copy(editableMesh.scale);
    highlight.renderOrder = 999;
    parent.add(highlight);

    return () => {
      parent.remove(highlight);
      highlight.geometry.dispose();
      (highlight.material as THREE.Material).dispose();
    };
  }, [
    onSurfaceSelection,
    editingTemporaryMesh,
    findMeshByKey,
    freeExtractionSourceMesh,
    selectedTriangles,
    sourceMesh022,
    surfaceSelectionRadius,
  ]);

  useEffect(() => {
    if (!extractSelectionKey || !sourceMesh022?.parent || editingTemporaryMesh)
      return;

    const temporaryTriangles = new Set(selectedTriangles);
    const temporary = createTemporaryMesh(sourceMesh022, temporaryTriangles);
    if (!temporary) return;

    temporarySelectionRef.current = temporaryTriangles;
    saveExtractionPreset({
      stage: "temporary",
      temporaryTriangles: [...temporaryTriangles],
      arrowTriangles: [],
    });

    selectionHistoryRef.current = [];
    setSelectedTriangles(new Set());
    setEditingTemporaryMesh(true);
    onExtraction({
      extracted: true,
      triangles: temporary.triangles,
      name: "Zone temporaire flèche + traverse",
      stage: "temporary",
    });
  }, [
    createTemporaryMesh,
    editingTemporaryMesh,
    extractSelectionKey,
    onExtraction,
    saveExtractionPreset,
    selectedTriangles,
    sourceMesh022,
  ]);

  useEffect(() => {
    if (
      !finalizeSeparationKey ||
      !editingTemporaryMesh ||
      !sourceMesh022?.parent
    )
      return;

    const parent = sourceMesh022.parent;
    const temporaryMesh = parent.getObjectByName(
      "mesh-022-temporary-extracted",
    ) as THREE.Mesh | undefined;
    if (!temporaryMesh) return;

    const arrowTriangles = new Set(selectedTriangles);
    const finalized = finalizeTemporaryMesh(
      sourceMesh022,
      temporaryMesh,
      arrowTriangles,
    );
    if (!finalized) return;

    saveExtractionPreset({
      stage: "separated",
      temporaryTriangles: [...temporarySelectionRef.current],
      arrowTriangles: [...arrowTriangles],
    });

    selectionHistoryRef.current = [];
    setSelectedTriangles(new Set());
    setEditingTemporaryMesh(false);
    onExtraction({
      extracted: true,
      triangles: finalized.traverseTriangles,
      name: "Traverse porte-palan séparée et sauvegardée",
      stage: "separated",
    });
  }, [
    editingTemporaryMesh,
    finalizeSeparationKey,
    finalizeTemporaryMesh,
    onExtraction,
    saveExtractionPreset,
    selectedTriangles,
    sourceMesh022,
  ]);

  useEffect(() => {
    if (!resetExtractionKey || !sourceMesh022?.parent) return;
    const original = sourceMesh022.userData.oysteOriginalGeometry as
      THREE.BufferGeometry | undefined;
    if (!original) return;
    const parent = sourceMesh022.parent;
    [
      "mesh-022-temporary-extracted",
      "mesh-022-arrow-restored",
      "mesh-022-traverse-extracted",
    ].forEach((name) => {
      const generated = parent.getObjectByName(name);
      if (!generated) return;
      parent.remove(generated);
      (generated as THREE.Mesh).geometry.dispose();
    });
    sourceMesh022.geometry.dispose();
    sourceMesh022.geometry = original.clone();
    selectionHistoryRef.current = [];
    temporarySelectionRef.current = new Set();
    localStorage.removeItem(EXTRACTION_PRESET_STORAGE_KEY);
    setSelectedTriangles(new Set());
    setEditingTemporaryMesh(false);
    onExtraction({
      extracted: false,
      triangles: 0,
      name: "",
      stage: "idle",
    });
  }, [resetExtractionKey, onExtraction, sourceMesh022]);

  useEffect(() => onStats(stats), [onStats, stats]);
  useEffect(() => onMeshes(meshes), [meshes, onMeshes]);
  useEffect(() => onIslands(islands), [islands, onIslands]);

  useEffect(() => {
    if (!surfaceSelectionMode) return;

    const canvas = gl.domElement;
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const pickingMaterial = new THREE.MeshBasicMaterial({
      side: THREE.DoubleSide,
    });

    type PickingCandidate = {
      meshKey: string;
      source: THREE.Mesh;
      picker: THREE.Mesh;
    };

    const collectPickingCandidates = (): PickingCandidate[] => {
      const candidates: PickingCandidate[] = [];
      model.updateWorldMatrix(true, true);

      const addCandidate = (source: THREE.Mesh, meshKey: string) => {
        if (!source.geometry?.getAttribute("position")) return;
        source.updateWorldMatrix(true, false);
        source.geometry.computeBoundingSphere();

        const picker = new THREE.Mesh(source.geometry, pickingMaterial);
        picker.matrixAutoUpdate = false;
        picker.frustumCulled = false;
        picker.matrixWorld.copy(source.matrixWorld);
        picker.userData.oysteMeshKey = meshKey;
        candidates.push({ meshKey, source, picker });
      };

      // An isolated mesh is the exclusive editing target. Resolve it directly
      // by its OYSTE key rather than relying on a filtered scene traversal:
      // generated visibility states or parent hierarchy changes must never
      // leave the picking engine with zero candidates.
      if (isolatedMesh) {
        const source = findMeshByKey(isolatedMesh);
        if (source) addCandidate(source, isolatedMesh);
        return candidates;
      }

      model.traverse((object) => {
        const source = object as THREE.Mesh;
        if (!source.isMesh) return;
        if (source.name === "oyste-surface-selection") return;
        const meshKey = source.userData.oysteMeshKey as string | undefined;
        if (!meshKey) return;

        if (isolatedGroup) {
          const group = functionalGroups.find(
            (candidateGroup) => candidateGroup.id === isolatedGroup,
          );
          const extractedGroup = source.userData.oysteExtractedGroup as
            | FunctionalGroupId
            | undefined;
          const dynamicGroup = source.userData.oysteDynamicGroup as
            | FunctionalGroupId
            | undefined;
          const belongsToIsolatedGroup =
            group?.meshKeys.includes(meshKey) ||
            extractedGroup === isolatedGroup ||
            dynamicGroup === isolatedGroup;
          if (!belongsToIsolatedGroup) return;
        } else if (!source.visible) {
          // Without isolation, hidden scene parts must not remain selectable.
          return;
        }

        addCandidate(source, meshKey);
      });
      return candidates;
    };

    const sampleOffsets: Array<[number, number]> = [[0, 0]];
    for (const radius of [3, 6, 10, 15, 22, 30]) {
      const steps = radius <= 6 ? 12 : 20;
      for (let step = 0; step < steps; step += 1) {
        const angle = (step / steps) * Math.PI * 2;
        sampleOffsets.push([
          Math.cos(angle) * radius,
          Math.sin(angle) * radius,
        ]);
      }
    }

    type PickResult = {
      intersection: THREE.Intersection<THREE.Object3D>;
      candidate: PickingCandidate;
      pixelDistance: number;
    };

    const findNearestProjectedTriangle = (
      candidate: PickingCandidate,
      clientX: number,
      clientY: number,
      rect: DOMRect,
    ): PickResult | null => {
      const geometry = candidate.source.geometry;
      const position = geometry.getAttribute("position");
      if (!position) return null;

      const index = geometry.getIndex();
      const triangleCount = index ? index.count / 3 : position.count / 3;
      const vertexAt = (offset: number) => (index ? index.getX(offset) : offset);
      const a = new THREE.Vector3();
      const b = new THREE.Vector3();
      const c = new THREE.Vector3();
      const centroid = new THREE.Vector3();
      const projected = new THREE.Vector3();
      const worldPoint = new THREE.Vector3();
      let nearest:
        | {
            faceIndex: number;
            worldPoint: THREE.Vector3;
            pixelDistance: number;
            cameraDistance: number;
          }
        | null = null;

      candidate.source.updateWorldMatrix(true, false);

      for (let triangle = 0; triangle < triangleCount; triangle += 1) {
        const offset = triangle * 3;
        a.fromBufferAttribute(position, vertexAt(offset));
        b.fromBufferAttribute(position, vertexAt(offset + 1));
        c.fromBufferAttribute(position, vertexAt(offset + 2));
        centroid.copy(a).add(b).add(c).multiplyScalar(1 / 3);
        worldPoint.copy(centroid).applyMatrix4(candidate.source.matrixWorld);
        projected.copy(worldPoint).project(camera);

        if (
          projected.z < -1 ||
          projected.z > 1 ||
          !Number.isFinite(projected.x) ||
          !Number.isFinite(projected.y)
        ) {
          continue;
        }

        const screenX = rect.left + ((projected.x + 1) / 2) * rect.width;
        const screenY = rect.top + ((1 - projected.y) / 2) * rect.height;
        const pixelDistance = Math.hypot(screenX - clientX, screenY - clientY);

        if (pixelDistance > 52) continue;

        const cameraDistance = camera.position.distanceTo(worldPoint);
        if (
          !nearest ||
          pixelDistance < nearest.pixelDistance ||
          (Math.abs(pixelDistance - nearest.pixelDistance) < 0.5 &&
            cameraDistance < nearest.cameraDistance)
        ) {
          nearest = {
            faceIndex: triangle,
            worldPoint: worldPoint.clone(),
            pixelDistance,
            cameraDistance,
          };
        }
      }

      if (!nearest) return null;

      const intersection = {
        distance: nearest.cameraDistance,
        point: nearest.worldPoint,
        object: candidate.picker,
        faceIndex: nearest.faceIndex,
      } as THREE.Intersection<THREE.Object3D>;

      return {
        intersection,
        candidate,
        pixelDistance: nearest.pixelDistance,
      };
    };

    const pickSurface = (clientX: number, clientY: number): PickResult | null => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return null;
      camera.updateMatrixWorld();
      const candidates = collectPickingCandidates();
      let best: PickResult | null = null;

      for (const [offsetX, offsetY] of sampleOffsets) {
        pointer.x = ((clientX + offsetX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((clientY + offsetY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(pointer, camera);

        for (const candidate of candidates) {
          const intersection = raycaster.intersectObject(candidate.picker, false)[0];
          if (!intersection || intersection.faceIndex == null) continue;
          const pixelDistance = Math.hypot(offsetX, offsetY);
          if (
            !best ||
            pixelDistance < best.pixelDistance ||
            (pixelDistance === best.pixelDistance &&
              (intersection.distance < best.intersection.distance - 1e-6 ||
                (Math.abs(
                  intersection.distance - best.intersection.distance,
                ) <= 1e-6 &&
                  best.candidate.meshKey === ROOT_MESH_KEY &&
                  candidate.meshKey !== ROOT_MESH_KEY)))
          ) {
            best = { intersection, candidate, pixelDistance };
          }
        }
        if (best?.pixelDistance === 0) break;
      }

      if (!best && isolatedMesh && candidates.length === 1) {
        best = findNearestProjectedTriangle(
          candidates[0],
          clientX,
          clientY,
          rect,
        );
      }

      return best as PickResult | null;
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      const hit = pickSurface(event.clientX, event.clientY);
      canvas.style.cursor = hit ? "copy" : "crosshair";
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      const hit = pickSurface(event.clientX, event.clientY);
      if (!hit) return;
      event.preventDefault();
      event.stopPropagation();
      setSurfaceSelectionMeshKey(hit.candidate.meshKey);
      onSurfacePoint(
        asTuple(hit.intersection.point),
        hit.intersection.faceIndex ?? null,
        hit.candidate.meshKey,
      );
    };

    canvas.style.cursor = "crosshair";
    canvas.addEventListener("pointermove", handlePointerMove, { passive: true });
    canvas.addEventListener("pointerdown", handlePointerDown, true);

    return () => {
      canvas.removeEventListener("pointermove", handlePointerMove);
      canvas.removeEventListener("pointerdown", handlePointerDown, true);
      canvas.style.cursor = "";
      pickingMaterial.dispose();
    };
  }, [
    camera,
    findMeshByKey,
    functionalGroups,
    gl,
    isolatedGroup,
    isolatedMesh,
    model,
    onSurfacePoint,
    surfaceSelectionMode,
  ]);

  return (
    <group
      scale={normalizedScale * transform.scale}
      position={transform.position}
      onDoubleClick={(event) => {
        if (surfaceSelectionMode) return;
        event.stopPropagation();
        onFocusPoint(asTuple(event.point));
      }}
    >
      <primitive object={model} />
    </group>
  );
}

function CameraRig({
  stats,
  preset,
  commandKey,
  fitKey,
  focusPoint,
  focusKey,
  onCameraChange,
}: {
  stats: ModelStats;
  preset: CameraPreset;
  commandKey: number;
  fitKey: number;
  focusPoint: Vector3Tuple | null;
  focusKey: number;
  onCameraChange: (camera: CameraPreset) => void;
}) {
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const { camera } = useThree();
  const firstFit = useRef(true);
  const lastFitKey = useRef(-1);

  const capture = useCallback(() => {
    const controls = controlsRef.current;
    const perspective = camera as THREE.PerspectiveCamera;
    if (!controls) return;
    onCameraChange({
      position: asTuple(camera.position),
      target: asTuple(controls.target),
      fov: round(perspective.fov, 2),
      zoom: round(perspective.zoom, 3),
    });
  }, [camera, onCameraChange]);

  useEffect(() => {
    const controls = controlsRef.current;
    const perspective = camera as THREE.PerspectiveCamera;
    if (!controls) return;
    camera.position.set(...preset.position);
    controls.target.set(...preset.target);
    perspective.fov = preset.fov;
    perspective.zoom = preset.zoom;
    perspective.near = 0.01;
    perspective.far = 1000;
    perspective.updateProjectionMatrix();
    controls.update();
    // preset is applied only when an explicit numeric command is issued.
  }, [camera, commandKey]);

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls || !focusPoint) return;
    controls.target.set(...focusPoint);
    controls.update();
    capture();
  }, [capture, focusKey, focusPoint]);

  useEffect(() => {
    if (!stats.displayHeight) return;
    if (!firstFit.current && lastFitKey.current === fitKey) return;
    firstFit.current = false;
    lastFitKey.current = fitKey;
    const perspective = camera as THREE.PerspectiveCamera;
    const maxDimension = Math.max(
      stats.displayWidth,
      stats.displayHeight,
      stats.displayDepth,
      1,
    );
    const fov = THREE.MathUtils.degToRad(perspective.fov || 38);
    const distance = (maxDimension / (2 * Math.tan(fov / 2))) * 1.45;
    const target = new THREE.Vector3(0, stats.displayHeight * 0.48, 0);
    camera.position
      .copy(target)
      .add(
        new THREE.Vector3(distance * 0.78, distance * 0.42, distance * 1.08),
      );
    controlsRef.current?.target.copy(target);
    perspective.near = 0.01;
    perspective.far = Math.max(1000, distance * 30);
    perspective.updateProjectionMatrix();
    controlsRef.current?.update();
    capture();
  }, [
    camera,
    capture,
    fitKey,
    stats.displayDepth,
    stats.displayHeight,
    stats.displayWidth,
  ]);

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      minDistance={0.01}
      maxDistance={1000}
      minPolarAngle={0}
      maxPolarAngle={Math.PI}
      enablePan
      screenSpacePanning
      zoomToCursor
      rotateSpeed={0.85}
      zoomSpeed={1.15}
      panSpeed={1.1}
      mouseButtons={{
        LEFT: THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.PAN,
        RIGHT: THREE.MOUSE.PAN,
      }}
      touches={{ ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }}
      onEnd={capture}
    />
  );
}

function RendererSettings({ exposure }: { exposure: number }) {
  const { gl } = useThree();
  useEffect(() => {
    gl.toneMappingExposure = exposure;
  }, [exposure, gl]);
  return null;
}

function LoadingModel() {
  return (
    <Html center>
      <div className="rounded-2xl border border-slate-200 bg-white/95 px-5 py-4 text-center shadow-xl">
        <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-slate-900" />
        <p className="text-sm font-semibold text-slate-900">
          Chargement du modèle 3D
        </p>
      </div>
    </Html>
  );
}

function NumberControl({
  label,
  value,
  step = 0.1,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  step?: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-black uppercase tracking-[0.13em] text-slate-500">
        {label}
      </span>
      <input
        type="number"
        value={Number.isFinite(value) ? value : 0}
        step={step}
        min={min}
        max={max}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-bold text-slate-900 outline-none focus:border-sky-500"
      />
    </label>
  );
}

function Section({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-black text-slate-950"
      >
        <span>{title}</span>
        {open ? (
          <ChevronUp className="h-4 w-4" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )}
      </button>
      {open ? (
        <div className="border-t border-slate-100 p-4">{children}</div>
      ) : null}
    </div>
  );
}

export default function Oyste3DLab() {
  const [viewMode, setViewMode] = useState<ViewMode>("industrial");
  const [showGrid, setShowGrid] = useState(true),
    [showAxes, setShowAxes] = useState(true),
    [showShadows, setShowShadows] = useState(true),
    [wireframe, setWireframe] = useState(false);
  const [fitKey, setFitKey] = useState(0),
    [cameraCommandKey, setCameraCommandKey] = useState(0);
  const [focusPoint, setFocusPoint] = useState<Vector3Tuple | null>(null),
    [focusKey, setFocusKey] = useState(0);
  const [stats, setStats] = useState<ModelStats>(INITIAL_STATS),
    [meshes, setMeshes] = useState<MeshDescriptor[]>([]);
  const [hiddenMeshes, setHiddenMeshes] = useState<Set<string>>(
      () => new Set(),
    ),
    [isolatedMesh, setIsolatedMesh] = useState<string | null>(null),
    [isolatedGroup, setIsolatedGroup] = useState<FunctionalGroupId | null>(
      null,
    );
  const [islands, setIslands] = useState<IslandDescriptor[]>([]);
  const [hiddenIslands, setHiddenIslands] = useState<Set<string>>(
    () => new Set(),
  );
  const [isolatedIsland, setIsolatedIsland] = useState<string | null>(null);
  const [surfaceSelectionMode, setSurfaceSelectionMode] = useState(false);
  const [surfaceSelectionRadius, setSurfaceSelectionRadius] = useState(0.28);
  const [surfaceSelectionOperation, setSurfaceSelectionOperation] =
    useState<SurfaceSelectionOperation>("add");
  const [surfaceSelectionPoint, setSurfaceSelectionPoint] =
    useState<Vector3Tuple | null>(null);
  const [surfaceSelectionFaceIndex, setSurfaceSelectionFaceIndex] =
    useState<number | null>(null);
  const [surfaceSelectionActionKey, setSurfaceSelectionActionKey] = useState(0);
  const [invertSelectionKey, setInvertSelectionKey] = useState(0);
  const [clearSelectionKey, setClearSelectionKey] = useState(0);
  const [undoSelectionKey, setUndoSelectionKey] = useState(0);
  const [surfaceSelectionInfo, setSurfaceSelectionInfo] =
    useState<SurfaceSelectionInfo>({ triangles: 0, radius: 0.28 });
  const [extractSelectionKey, setExtractSelectionKey] = useState(0);
  const [finalizeSeparationKey, setFinalizeSeparationKey] = useState(0);
  const [resetExtractionKey, setResetExtractionKey] = useState(0);
  const [freeExtractionKey, setFreeExtractionKey] = useState(0);
  const [resetFreeExtractionsKey, setResetFreeExtractionsKey] = useState(0);
  const [freeExtractionName, setFreeExtractionName] = useState(
    "Point fixation ligne d’alimentation",
  );
  const [freeExtractionGroup, setFreeExtractionGroup] =
    useState<FunctionalGroupId>("powerSupply");
  const [freeExtractionRemainingName, setFreeExtractionRemainingName] =
    useState("");
  const [freeExtractionRemainingGroup, setFreeExtractionRemainingGroup] =
    useState<FunctionalGroupId>("structure");
  const [freeExtractions, setFreeExtractions] = useState<
    FreeExtractionRecord[]
  >([]);
  const [extractionInfo, setExtractionInfo] = useState<ExtractionInfo>({
    extracted: false,
    triangles: 0,
    name: "",
    stage: "idle",
  });
  const [meshMapping, setMeshMapping] = useState<MeshMapping>({}),
    [meshValidation, setMeshValidation] = useState<MeshValidationMap>({}),
    [selectedMesh, setSelectedMesh] = useState<string | null>(null),
    [draftName, setDraftName] = useState(""),
    [draftValidationNote, setDraftValidationNote] = useState(""),
    [validationFilter, setValidationFilter] = useState<
      "all" | MeshValidationStatus
    >("all"),
    [searchTerm, setSearchTerm] = useState("");
  const [copyState, setCopyState] = useState<
    "idle" | "mapping" | "preset" | "extraction"
  >("idle");
  const [modelTransform, setModelTransform] =
      useState<ModelTransform>(INITIAL_MODEL),
    [cameraPreset, setCameraPreset] = useState<CameraPreset>(INITIAL_CAMERA),
    [lights, setLights] = useState<LightSettings>(INITIAL_LIGHTS);
  const [openSections, setOpenSections] = useState({
    camera: true,
    model: true,
    lights: false,
    display: false,
    groups: true,
    decomposition: true,
    surface: true,
  });

  useEffect(() => {
    try {
      const savedMapping = localStorage.getItem(MESH_MAPPING_STORAGE_KEY);
      const parsedMapping: MeshMapping = savedMapping
        ? JSON.parse(savedMapping)
        : {};
      const migratedMapping = {
        ...parsedMapping,
        ...REQUIRED_MESH_MAPPING,
      };
      setMeshMapping(migratedMapping);
      localStorage.setItem(
        MESH_MAPPING_STORAGE_KEY,
        JSON.stringify(migratedMapping),
      );
      const savedFreeExtractions = localStorage.getItem(
        FREE_EXTRACTIONS_STORAGE_KEY,
      );
      if (savedFreeExtractions) {
        setFreeExtractions(JSON.parse(savedFreeExtractions));
      }
      const savedPreset = localStorage.getItem(DEV_PRESET_STORAGE_KEY);
      if (savedPreset) {
        const parsed = JSON.parse(savedPreset);
        if (parsed.camera) {
          setCameraPreset(parsed.camera);
          setCameraCommandKey((value) => value + 1);
        }
        if (parsed.model) setModelTransform(parsed.model);
        if (parsed.lights) setLights(parsed.lights);
      }
      const savedValidation = localStorage.getItem(MESH_VALIDATION_STORAGE_KEY);
      if (savedValidation) setMeshValidation(JSON.parse(savedValidation));
    } catch {
      /* debug storage must never block the lab */
    }
  }, []);

  const handleMeshes = useCallback((next: MeshDescriptor[]) => {
    setMeshes(next);
    setSelectedMesh(
      (current) =>
        current ?? next.find((mesh) => mesh.key !== ROOT_MESH_KEY)?.key ?? null,
    );
  }, []);
  useEffect(() => {
    setDraftName(selectedMesh ? (meshMapping[selectedMesh] ?? "") : "");
    setDraftValidationNote(
      selectedMesh ? (meshValidation[selectedMesh]?.note ?? "") : "",
    );
  }, [meshMapping, meshValidation, selectedMesh]);
  const filteredMeshes = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return meshes.filter((mesh) => {
      const matchesSearch =
        !q ||
        [
          mesh.key,
          mesh.meshName,
          mesh.nodeName,
          mesh.materialName,
          meshMapping[mesh.key] ?? "",
          meshValidation[mesh.key]?.note ?? "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(q);
      const status = meshValidation[mesh.key]?.status ?? "pending";
      const matchesStatus =
        validationFilter === "all" || status === validationFilter;
      return matchesSearch && matchesStatus;
    });
  }, [meshMapping, meshValidation, meshes, searchTerm, validationFilter]);

  const saveMapping = useCallback(() => {
    if (!selectedMesh || selectedMesh === ROOT_MESH_KEY) return;
    const next = { ...meshMapping };
    const name = draftName.trim();
    if (name) next[selectedMesh] = name;
    else delete next[selectedMesh];
    setMeshMapping(next);
    localStorage.setItem(MESH_MAPPING_STORAGE_KEY, JSON.stringify(next));
  }, [draftName, meshMapping, selectedMesh]);
  const updateMeshValidation = useCallback(
    (key: string, patch: Partial<Omit<MeshValidationRecord, "updatedAt">>) => {
      setMeshValidation((current) => {
        const previous = current[key] ?? {
          status: "pending" as MeshValidationStatus,
          group: "unassigned" as MeshValidationGroup,
          note: "",
          updatedAt: new Date().toISOString(),
        };
        const next = {
          ...current,
          [key]: {
            ...previous,
            ...patch,
            updatedAt: new Date().toISOString(),
          },
        };
        localStorage.setItem(MESH_VALIDATION_STORAGE_KEY, JSON.stringify(next));
        return next;
      });
    },
    [],
  );
  const saveValidationNote = useCallback(() => {
    if (!selectedMesh) return;
    updateMeshValidation(selectedMesh, { note: draftValidationNote.trim() });
  }, [draftValidationNote, selectedMesh, updateMeshValidation]);
  const selectNextPendingMesh = useCallback(() => {
    if (!meshes.length) return;
    const currentIndex = Math.max(
      0,
      meshes.findIndex((mesh) => mesh.key === selectedMesh),
    );
    const ordered = [
      ...meshes.slice(currentIndex + 1),
      ...meshes.slice(0, currentIndex + 1),
    ];
    const next = ordered.find(
      (mesh) =>
        mesh.key !== ROOT_MESH_KEY &&
        mesh.key !== selectedMesh &&
        (meshValidation[mesh.key]?.status ?? "pending") !== "validated",
    );
    if (!next) return;
    setSelectedMesh(next.key);
    setIsolatedGroup(null);
    setIsolatedMesh(next.key);
  }, [meshValidation, meshes, selectedMesh]);
  const effectiveFunctionalGroups = useMemo<FunctionalGroup[]>(() => {
    const assigned = new Map<string, MeshValidationGroup>();
    Object.entries(meshValidation).forEach(([meshKey, record]) => {
      if (record.group !== "unassigned") assigned.set(meshKey, record.group);
    });

    return FUNCTIONAL_GROUPS.map((group) => {
      const baseKeys = group.meshKeys.filter((meshKey) => {
        const override = assigned.get(meshKey);
        if (!override) return true;
        if (override === "ignore") return false;
        return override === group.id;
      });
      const reassignedKeys = [...assigned.entries()]
        .filter(([, target]) => target === group.id)
        .map(([meshKey]) => meshKey);
      const extractionKeys = freeExtractions
        .filter((item) => item.group === group.id)
        .map((item) => item.id);
      return {
        ...group,
        meshKeys: [...new Set([...baseKeys, ...reassignedKeys, ...extractionKeys])],
      };
    });
  }, [freeExtractions, meshValidation]);

  const toggleMesh = useCallback((key: string) => {
    if (key === ROOT_MESH_KEY) return;
    setIsolatedMesh(null);
    setIsolatedGroup(null);
    setHiddenMeshes((current) => {
      const next = new Set(current);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }, []);
  const toggleGroup = useCallback((group: FunctionalGroup) => {
    setIsolatedMesh(null);
    setIsolatedGroup(null);
    setHiddenMeshes((current) => {
      const next = new Set(current);
      const allHidden = group.meshKeys.every((key) => next.has(key));
      group.meshKeys.forEach((key) =>
        allHidden ? next.delete(key) : next.add(key),
      );
      return next;
    });
  }, []);
  const isolateGroup = useCallback((group: FunctionalGroup) => {
    setIsolatedMesh(null);
    setIsolatedGroup((current) => (current === group.id ? null : group.id));
  }, []);
  const showAllMeshes = useCallback(() => {
    setHiddenMeshes(new Set());
    setHiddenIslands(new Set());
    setIsolatedMesh(null);
    setIsolatedGroup(null);
    setIsolatedIsland(null);
  }, []);
  const toggleIsland = useCallback((key: string) => {
    setIsolatedMesh(null);
    setIsolatedGroup(null);
    setIsolatedIsland(null);
    setHiddenIslands((current) => {
      const next = new Set(current);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }, []);
  const updateVector = <T extends "position" | "target">(
    key: T,
    index: number,
    value: number,
  ) => {
    setCameraPreset((current) => ({
      ...current,
      [key]: current[key].map((v, i) =>
        i === index ? value : v,
      ) as Vector3Tuple,
    }));
    setCameraCommandKey((v) => v + 1);
  };
  const updateModelVector = (
    key: "rotation" | "position",
    index: number,
    value: number,
  ) =>
    setModelTransform((current) => ({
      ...current,
      [key]: current[key].map((v, i) =>
        i === index ? value : v,
      ) as Vector3Tuple,
    }));
  const applyCameraNumber = (key: "fov" | "zoom", value: number) => {
    setCameraPreset((current) => ({ ...current, [key]: value }));
    setCameraCommandKey((v) => v + 1);
  };
  const saveDeveloperPreset = () =>
    localStorage.setItem(
      DEV_PRESET_STORAGE_KEY,
      JSON.stringify(
        { camera: cameraPreset, model: modelTransform, lights },
        null,
        2,
      ),
    );
  const resetDeveloperPreset = () => {
    setModelTransform(INITIAL_MODEL);
    setLights(INITIAL_LIGHTS);
    setCameraPreset(INITIAL_CAMERA);
    setCameraCommandKey((v) => v + 1);
    setFitKey((v) => v + 1);
  };

  const copyMapping = useCallback(async () => {
    const payload = {
      model: "PFI125_3_COMPLETE",
      path: PFI_MODEL_PATH,
      camera: cameraPreset,
      root: { id: ROOT_MESH_KEY, name: "Assemblage complet", protected: true },
      groups: Object.fromEntries(
        effectiveFunctionalGroups.map((group) => [
          group.id,
          {
            label: group.label,
            meshes: [
              ...group.meshKeys,
            ],
          },
        ]),
      ),
      freeExtractions,
      validation: {
        summary: {
          total: meshes.length,
          validated: meshes.filter(
            (mesh) => meshValidation[mesh.key]?.status === "validated",
          ).length,
          review: meshes.filter(
            (mesh) => meshValidation[mesh.key]?.status === "review",
          ).length,
        },
        records: meshValidation,
      },
      meshes: meshes.map((mesh) => ({
        id: mesh.key,
        name:
          mesh.key === ROOT_MESH_KEY
            ? "Assemblage complet — racine protégée"
            : (meshMapping[mesh.key] ?? ""),
        protected: mesh.key === ROOT_MESH_KEY,
        source: {
          node: mesh.nodeName,
          mesh: mesh.meshName,
          material: mesh.materialName,
        },
      })),
    };
    await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    setCopyState("mapping");
    setTimeout(() => setCopyState("idle"), 1600);
  }, [
    cameraPreset,
    effectiveFunctionalGroups,
    freeExtractions,
    meshMapping,
    meshValidation,
    meshes,
  ]);
  const copyExtractionPreset = useCallback(async () => {
    const freeRaw = localStorage.getItem(FREE_EXTRACTIONS_STORAGE_KEY);
    if (freeRaw) {
      const records = JSON.parse(freeRaw) as FreeExtractionRecord[];
      if (records.length) {
        await navigator.clipboard.writeText(
          JSON.stringify(
            {
              model: "PFI125_3_COMPLETE",
              path: PFI_MODEL_PATH,
              freeExtractions: records,
            },
            null,
            2,
          ),
        );
        setCopyState("extraction");
        setTimeout(() => setCopyState("idle"), 1600);
        return;
      }
    }

    const raw = localStorage.getItem(EXTRACTION_PRESET_STORAGE_KEY);
    if (!raw) return;
    await navigator.clipboard.writeText(
      JSON.stringify(JSON.parse(raw), null, 2),
    );
    setCopyState("extraction");
    setTimeout(() => setCopyState("idle"), 1600);
  }, []);

  const copyPreset = useCallback(async () => {
    const payload = {
      model: "PFI125_3_COMPLETE",
      camera: cameraPreset,
      modelTransform,
      lights,
      display: {
        viewMode,
        grid: showGrid,
        axes: showAxes,
        shadows: showShadows,
        wireframe,
      },
    };
    await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    setCopyState("preset");
    setTimeout(() => setCopyState("idle"), 1600);
  }, [
    cameraPreset,
    lights,
    modelTransform,
    showAxes,
    showGrid,
    showShadows,
    viewMode,
    wireframe,
  ]);

  const namedCount = Object.values(meshMapping as MeshMapping).filter(
    (value: string) => value.trim(),
  ).length;
  const validationMeshes = meshes.filter((mesh) => mesh.key !== ROOT_MESH_KEY);
  const validatedCount = validationMeshes.filter(
    (mesh) => meshValidation[mesh.key]?.status === "validated",
  ).length;
  const reviewCount = validationMeshes.filter(
    (mesh) => meshValidation[mesh.key]?.status === "review",
  ).length;
  const validationPercent = validationMeshes.length
    ? Math.round((validatedCount / validationMeshes.length) * 100)
    : 0;
  const selectedDescriptor =
    meshes.find((mesh) => mesh.key === selectedMesh) ?? null;

  return (
    <section className="min-h-screen bg-[radial-gradient(circle_at_top_left,#e0f2fe_0,#f8fafc_34%,#f1f5f9_100%)] py-8 sm:py-12">
      <div className="mx-auto w-full max-w-[1900px] px-4 sm:px-7">
        <div className="overflow-hidden rounded-[2rem] border border-white/80 bg-white/80 shadow-[0_30px_90px_rgba(15,23,42,0.12)]">
          <div className="grid xl:grid-cols-[minmax(0,1fr)_520px]">
            <div className="relative min-h-[860px] bg-slate-950">
              <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-3 p-5">
                <div className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-white/80">
                  OYSTE 3D Lab · Developer Tools
                </div>
                <div className="rounded-full border border-emerald-300/30 bg-emerald-400/10 px-4 py-2 text-xs font-semibold text-emerald-100">
                  {stats.meshes
                    ? `${stats.meshes} meshes · ${namedCount} identifiés`
                    : "Chargement"}
                </div>
              </div>
              <Canvas
                shadows={showShadows}
                camera={{
                  position: INITIAL_CAMERA.position,
                  fov: INITIAL_CAMERA.fov,
                  near: 0.01,
                  far: 1000,
                }}
                gl={{ antialias: true, alpha: false }}
                className="h-full min-h-[860px]"
              >
                <RendererSettings exposure={lights.exposure} />
                <color
                  attach="background"
                  args={[viewMode === "industrial" ? "#0f172a" : "#f8fafc"]}
                />
                <ambientLight intensity={lights.ambient} />
                <hemisphereLight
                  args={["#e0f2fe", "#1e293b", lights.hemisphere]}
                />
                <directionalLight
                  position={[7, 9, 6]}
                  intensity={lights.key}
                  castShadow={showShadows}
                />
                <directionalLight
                  position={[-5, 4, -4]}
                  intensity={lights.fill}
                />
                <Suspense fallback={<LoadingModel />}>
                  <PfiModel
                    viewMode={viewMode}
                    hiddenMeshes={hiddenMeshes}
                    isolatedMesh={isolatedMesh}
                    isolatedGroup={isolatedGroup}
                    transform={modelTransform}
                    wireframe={wireframe}
                    shadows={showShadows}
                    onStats={setStats}
                    onMeshes={handleMeshes}
                    onFocusPoint={(point) => {
                      setFocusPoint(point);
                      setFocusKey((value) => value + 1);
                    }}
                    hiddenIslands={hiddenIslands}
                    isolatedIsland={isolatedIsland}
                    onIslands={setIslands}
                    surfaceSelectionMode={surfaceSelectionMode}
                    surfaceSelectionRadius={surfaceSelectionRadius}
                    surfaceSelectionPoint={surfaceSelectionPoint}
                    surfaceSelectionFaceIndex={surfaceSelectionFaceIndex}
                    surfaceSelectionActionKey={surfaceSelectionActionKey}
                    surfaceSelectionOperation={surfaceSelectionOperation}
                    invertSelectionKey={invertSelectionKey}
                    clearSelectionKey={clearSelectionKey}
                    undoSelectionKey={undoSelectionKey}
                    onSurfacePoint={(point, faceIndex, meshKey) => {
                      setSelectedMesh(meshKey);
                      setSurfaceSelectionPoint(point);
                      setSurfaceSelectionFaceIndex(faceIndex);
                      setSurfaceSelectionActionKey((value) => value + 1);
                    }}
                    onSurfaceSelection={setSurfaceSelectionInfo}
                    extractSelectionKey={extractSelectionKey}
                    finalizeSeparationKey={finalizeSeparationKey}
                    resetExtractionKey={resetExtractionKey}
                    freeExtractionKey={freeExtractionKey}
                    freeExtractionName={freeExtractionName}
                    freeExtractionGroup={freeExtractionGroup}
                    freeExtractionSourceMesh={selectedMesh ?? "mesh-022"}
                    freeExtractionRemainingName={freeExtractionRemainingName}
                    freeExtractionRemainingGroup={freeExtractionRemainingGroup}
                    functionalGroups={effectiveFunctionalGroups}
                    resetFreeExtractionsKey={resetFreeExtractionsKey}
                    onFreeExtraction={(record) => {
                      if (!record) return;
                      setFreeExtractions((current) => [
                        ...current.filter((item) => item.id !== record.id),
                        record,
                      ]);
                      setSurfaceSelectionPoint(null);
                      setSurfaceSelectionFaceIndex(null);
                      setSurfaceSelectionInfo({
                        triangles: 0,
                        radius: surfaceSelectionRadius,
                      });
                    }}
                    onExtraction={(info) => {
                      setExtractionInfo(info);
                      if (info.extracted) {
                        setSurfaceSelectionPoint(null);
                        setSurfaceSelectionInfo({
                          triangles: 0,
                          radius: surfaceSelectionRadius,
                        });
                      }
                    }}
                  />
                  <Environment
                    preset={viewMode === "industrial" ? "city" : "warehouse"}
                  />
                  {showShadows ? (
                    <ContactShadows
                      position={[0, 0, 0]}
                      opacity={0.4}
                      scale={12}
                      blur={2.8}
                      far={8}
                    />
                  ) : null}
                </Suspense>
                {showGrid ? (
                  <gridHelper
                    args={[
                      20,
                      40,
                      "#38bdf8",
                      viewMode === "industrial" ? "#334155" : "#cbd5e1",
                    ]}
                  />
                ) : null}
                {showAxes ? (
                  <axesHelper args={[3]} position={[-4, 0.03, -4]} />
                ) : null}
                <CameraRig
                  stats={stats}
                  preset={cameraPreset}
                  commandKey={cameraCommandKey}
                  fitKey={fitKey}
                  focusPoint={focusPoint}
                  focusKey={focusKey}
                  onCameraChange={setCameraPreset}
                />
              </Canvas>
            </div>

            <aside className="flex max-h-[980px] flex-col bg-white">
              <div className="border-b border-slate-200 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.25em] text-sky-700">
                      Outils de visualisation 3D
                    </p>
                    <h1 className="mt-2 text-2xl font-black text-slate-950">
                      Éditeur de scène 3D
                    </h1>
                    <p className="mt-1 text-sm text-slate-600">
                      Calibre, cartographie et exporte les presets sans modifier
                      le code.
                    </p>
                  </div>
                  <Settings2 className="h-7 w-7 text-sky-700" />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setFitKey((v) => v + 1)}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-3 py-2 text-xs font-bold text-white"
                  >
                    <Maximize2 className="h-4 w-4" /> AutoFit
                  </button>
                  <button
                    onClick={resetDeveloperPreset}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold"
                  >
                    <RotateCcw className="h-4 w-4" /> Réinitialiser
                  </button>
                  <button
                    onClick={saveDeveloperPreset}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold"
                  >
                    <Save className="h-4 w-4" /> Sauvegarder
                  </button>
                  <button
                    onClick={copyPreset}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-700 px-3 py-2 text-xs font-bold text-white"
                  >
                    <Copy className="h-4 w-4" />{" "}
                    {copyState === "preset" ? "Preset copié" : "Copier preset"}
                  </button>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-4 space-y-3">
                <Section
                  title="Caméra"
                  open={openSections.camera}
                  onToggle={() =>
                    setOpenSections((s) => ({ ...s, camera: !s.camera }))
                  }
                >
                  <div className="grid grid-cols-3 gap-2">
                    {cameraPreset.position.map((v, i) => (
                      <NumberControl
                        key={`cp${i}`}
                        label={`Position ${"XYZ"[i]}`}
                        value={v}
                        step={0.1}
                        onChange={(n) => updateVector("position", i, n)}
                      />
                    ))}
                    {cameraPreset.target.map((v, i) => (
                      <NumberControl
                        key={`ct${i}`}
                        label={`Cible ${"XYZ"[i]}`}
                        value={v}
                        step={0.1}
                        onChange={(n) => updateVector("target", i, n)}
                      />
                    ))}
                    <NumberControl
                      label="FOV"
                      value={cameraPreset.fov}
                      step={1}
                      min={10}
                      max={100}
                      onChange={(n) => applyCameraNumber("fov", n)}
                    />
                    <NumberControl
                      label="Zoom"
                      value={cameraPreset.zoom}
                      step={0.05}
                      min={0.1}
                      max={10}
                      onChange={(n) => applyCameraNumber("zoom", n)}
                    />
                  </div>
                  <p className="mt-3 text-xs text-slate-500">
                    La souris met automatiquement ces valeurs à jour : rotation,
                    zoom et déplacement libre.
                  </p>
                </Section>
                <Section
                  title="Modèle"
                  open={openSections.model}
                  onToggle={() =>
                    setOpenSections((s) => ({ ...s, model: !s.model }))
                  }
                >
                  <div className="grid grid-cols-3 gap-2">
                    {modelTransform.rotation.map((v, i) => (
                      <NumberControl
                        key={`mr${i}`}
                        label={`Rotation ${"XYZ"[i]}`}
                        value={v}
                        step={1}
                        onChange={(n) => updateModelVector("rotation", i, n)}
                      />
                    ))}
                    {modelTransform.position.map((v, i) => (
                      <NumberControl
                        key={`mp${i}`}
                        label={`Position ${"XYZ"[i]}`}
                        value={v}
                        step={0.05}
                        onChange={(n) => updateModelVector("position", i, n)}
                      />
                    ))}
                    <NumberControl
                      label="Échelle"
                      value={modelTransform.scale}
                      step={0.05}
                      min={0.05}
                      max={20}
                      onChange={(n) =>
                        setModelTransform((s) => ({ ...s, scale: n }))
                      }
                    />
                  </div>
                </Section>
                <Section
                  title="Lumières"
                  open={openSections.lights}
                  onToggle={() =>
                    setOpenSections((s) => ({ ...s, lights: !s.lights }))
                  }
                >
                  <div className="grid grid-cols-2 gap-2">
                    <NumberControl
                      label="Ambiante"
                      value={lights.ambient}
                      step={0.1}
                      min={0}
                      max={10}
                      onChange={(n) => setLights((s) => ({ ...s, ambient: n }))}
                    />
                    <NumberControl
                      label="Hémisphère"
                      value={lights.hemisphere}
                      step={0.1}
                      min={0}
                      max={10}
                      onChange={(n) =>
                        setLights((s) => ({ ...s, hemisphere: n }))
                      }
                    />
                    <NumberControl
                      label="Principale"
                      value={lights.key}
                      step={0.1}
                      min={0}
                      max={20}
                      onChange={(n) => setLights((s) => ({ ...s, key: n }))}
                    />
                    <NumberControl
                      label="Remplissage"
                      value={lights.fill}
                      step={0.1}
                      min={0}
                      max={20}
                      onChange={(n) => setLights((s) => ({ ...s, fill: n }))}
                    />
                    <NumberControl
                      label="Exposition"
                      value={lights.exposure}
                      step={0.05}
                      min={0.1}
                      max={5}
                      onChange={(n) =>
                        setLights((s) => ({ ...s, exposure: n }))
                      }
                    />
                  </div>
                </Section>
                <Section
                  title="Affichage"
                  open={openSections.display}
                  onToggle={() =>
                    setOpenSections((s) => ({ ...s, display: !s.display }))
                  }
                >
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      ["Grille", showGrid, setShowGrid],
                      ["Axes", showAxes, setShowAxes],
                      ["Ombres", showShadows, setShowShadows],
                      ["Wireframe", wireframe, setWireframe],
                    ].map(([label, value, setter]) => (
                      <button
                        key={label as string}
                        type="button"
                        onClick={() =>
                          (
                            setter as React.Dispatch<
                              React.SetStateAction<boolean>
                            >
                          )((v) => !v)
                        }
                        className={`rounded-xl border px-3 py-2 text-xs font-bold ${(value as boolean) ? "border-sky-500 bg-sky-50 text-sky-800" : "border-slate-200 text-slate-600"}`}
                      >
                        {label as string} {(value as boolean) ? "ON" : "OFF"}
                      </button>
                    ))}
                    <button
                      onClick={() =>
                        setViewMode((v) =>
                          v === "industrial" ? "technical" : "industrial",
                        )
                      }
                      className="col-span-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold"
                    >
                      Vue{" "}
                      {viewMode === "industrial" ? "industrielle" : "technique"}
                    </button>
                  </div>
                </Section>

                <Section
                  title="Groupes fonctionnels"
                  open={openSections.groups}
                  onToggle={() =>
                    setOpenSections((s) => ({ ...s, groups: !s.groups }))
                  }
                >
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800">
                      <ShieldCheck className="h-4 w-4" />
                      <span>
                        <b>{ROOT_MESH_KEY}</b> · Assemblage complet protégé
                      </span>
                    </div>
                    {effectiveFunctionalGroups.map((group) => {
                      const allHidden = group.meshKeys.every((key) =>
                        hiddenMeshes.has(key),
                      );
                      const activeIsolation = isolatedGroup === group.id;
                      const inspectionActive =
                        activeIsolation ||
                        group.meshKeys.includes(isolatedMesh ?? "");
                      return (
                        <div
                          key={group.id}
                          className={`rounded-2xl border p-3 ${activeIsolation ? "border-violet-400 bg-violet-50" : "border-slate-200 bg-slate-50"}`}
                        >
                          <div className="flex items-start gap-3">
                            <div className="rounded-xl bg-white p-2 text-sky-700 shadow-sm">
                              <Layers3 className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-sm font-black text-slate-950">
                                  {group.label}
                                </p>
                                <span className="rounded-full bg-white px-2 py-1 text-[10px] font-black text-slate-500">
                                  {group.meshKeys.length} meshes
                                </span>
                              </div>
                              <p className="mt-0.5 text-xs text-slate-500">
                                {group.description}
                              </p>
                            </div>
                          </div>
                          <div className="mt-3 grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => toggleGroup(group)}
                              className="rounded-xl border border-slate-200 bg-white py-2 text-xs font-bold text-slate-700"
                            >
                              {allHidden ? (
                                <Eye className="mr-1 inline h-4 w-4" />
                              ) : (
                                <EyeOff className="mr-1 inline h-4 w-4" />
                              )}
                              {allHidden ? "Afficher" : "Masquer"}
                            </button>
                            <button
                              type="button"
                              onClick={() => isolateGroup(group)}
                              className={`rounded-xl py-2 text-xs font-bold text-white ${activeIsolation ? "bg-violet-700" : "bg-slate-950"}`}
                            >
                              <Crosshair className="mr-1 inline h-4 w-4" />
                              {activeIsolation ? "Quitter" : "Isoler"}
                            </button>
                          </div>
                          {inspectionActive ? (
                            <div className="mt-3 space-y-2 rounded-xl border border-violet-200 bg-white/80 p-2">
                              <div className="flex items-center justify-between px-1">
                                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-violet-700">
                                  Inspection mesh par mesh
                                </p>
                                <span className="text-[10px] font-bold text-slate-400">
                                  {group.meshKeys.length} éléments
                                </span>
                              </div>
                              {group.meshKeys.map((meshKey) => {
                                const descriptor = meshes.find(
                                  (mesh) => mesh.key === meshKey,
                                );
                                const businessName = meshMapping[meshKey]?.trim();
                                const meshIsolated = isolatedMesh === meshKey;
                                return (
                                  <div
                                    key={meshKey}
                                    className={`rounded-lg border p-2 ${meshIsolated ? "border-violet-400 bg-violet-50" : "border-slate-200 bg-white"}`}
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="min-w-0">
                                        <p className="text-xs font-black text-slate-950">
                                          {meshKey}
                                        </p>
                                        <p className="truncate text-[11px] font-bold text-sky-700">
                                          {businessName || descriptor?.meshName || "Nom à identifier"}
                                        </p>
                                        <p className="truncate text-[10px] text-slate-400">
                                          {descriptor?.materialName || "Matériau inconnu"}
                                        </p>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setSelectedMesh(meshKey);
                                          setIsolatedGroup(null);
                                          setIsolatedMesh((current) =>
                                            current === meshKey ? null : meshKey,
                                          );
                                          setOpenSections((current) => ({
                                            ...current,
                                            surface: true,
                                          }));
                                        }}
                                        className={`shrink-0 rounded-lg px-2.5 py-1.5 text-[10px] font-black text-white ${meshIsolated ? "bg-violet-700" : "bg-slate-950"}`}
                                      >
                                        <Crosshair className="mr-1 inline h-3.5 w-3.5" />
                                        {meshIsolated ? "Quitter" : "Isoler ce mesh"}
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                              <p className="px-1 text-[10px] leading-relaxed text-slate-500">
                                Isole un mesh pour l’identifier visuellement puis utilise la section
                                « Sélection de surface » si tu dois inspecter sa géométrie.
                              </p>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                    <button
                      type="button"
                      onClick={showAllMeshes}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2.5 text-xs font-black text-sky-800"
                    >
                      <Boxes className="h-4 w-4" /> Réafficher tous les groupes
                    </button>
                  </div>
                </Section>

                <Section
                  title={`Sélection de surface · ${selectedMesh ?? "mesh-022"}`}
                  open={openSections.surface}
                  onToggle={() =>
                    setOpenSections((s) => ({ ...s, surface: !s.surface }))
                  }
                >
                  <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-950">
                    Active le mode, puis clique près de la petite traverse. Le
                    sélecteur teste automatiquement une zone de tolérance autour
                    du curseur pour accrocher les pièces fines.
                  </div>
                  <button
                    type="button"
                    onClick={() => setSurfaceSelectionMode((value) => !value)}
                    className={`mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-black text-white ${surfaceSelectionMode ? "bg-rose-600" : "bg-slate-950"}`}
                  >
                    <MousePointer2 className="h-4 w-4" />
                    {surfaceSelectionMode
                      ? "Mode sélection actif"
                      : "Activer la sélection dans la vue"}
                  </button>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setSurfaceSelectionOperation("add")}
                      className={`rounded-xl border px-3 py-2 text-xs font-black ${
                        surfaceSelectionOperation === "add"
                          ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                          : "border-slate-200 bg-white text-slate-600"
                      }`}
                    >
                      Ajouter
                    </button>
                    <button
                      type="button"
                      onClick={() => setSurfaceSelectionOperation("subtract")}
                      className={`rounded-xl border px-3 py-2 text-xs font-black ${
                        surfaceSelectionOperation === "subtract"
                          ? "border-amber-500 bg-amber-50 text-amber-800"
                          : "border-slate-200 bg-white text-slate-600"
                      }`}
                    >
                      Retirer
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setInvertSelectionKey((value) => value + 1)
                      }
                      className="rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-black text-violet-800"
                    >
                      Inverser
                    </button>
                  </div>
                  <label className="mt-4 block">
                    <span className="flex items-center justify-between text-[10px] font-black uppercase tracking-[0.13em] text-slate-500">
                      Rayon de sélection
                      <b className="text-slate-900">
                        {surfaceSelectionRadius.toFixed(2)}
                      </b>
                    </span>
                    <input
                      type="range"
                      min="0.03"
                      max="1.5"
                      step="0.01"
                      value={surfaceSelectionRadius}
                      onChange={(event) =>
                        setSurfaceSelectionRadius(Number(event.target.value))
                      }
                      className="mt-2 w-full accent-rose-600"
                    />
                  </label>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
                        Triangles sélectionnés
                      </p>
                      <p className="mt-1 text-lg font-black text-slate-950">
                        {surfaceSelectionInfo.triangles}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setUndoSelectionKey((value) => value + 1)}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700"
                    >
                      Annuler le dernier geste
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setClearSelectionKey((value) => value + 1);
                        setSurfaceSelectionPoint(null);
                      }}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700"
                    >
                      Tout effacer
                    </button>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      disabled={
                        surfaceSelectionInfo.triangles === 0 ||
                        extractionInfo.stage !== "idle"
                      }
                      onClick={() =>
                        setExtractSelectionKey((value) => value + 1)
                      }
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-2.5 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <ScanLine className="h-4 w-4" /> 1. Créer zone temporaire
                    </button>
                    <button
                      type="button"
                      disabled={
                        surfaceSelectionInfo.triangles === 0 ||
                        extractionInfo.stage !== "temporary"
                      }
                      onClick={() =>
                        setFinalizeSeparationKey((value) => value + 1)
                      }
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-700 px-3 py-2.5 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <ScanLine className="h-4 w-4" /> 2. Sélection = flèche
                    </button>
                    <button
                      type="button"
                      disabled={extractionInfo.stage === "idle" && freeExtractions.length === 0}
                      onClick={() => {
                        setResetExtractionKey((value) => value + 1);
                        setSurfaceSelectionPoint(null);
                        setSurfaceSelectionInfo({
                          triangles: 0,
                          radius: surfaceSelectionRadius,
                        });
                      }}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-black text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <RotateCcw className="h-4 w-4" /> Annuler
                    </button>
                  </div>
                  {extractionInfo.stage === "temporary" ? (
                    <div className="mt-3 rounded-xl border border-violet-200 bg-violet-50 p-3 text-xs text-violet-950">
                      <b>Étape 2 active :</b> la zone flèche + traverse est
                      maintenant un mesh temporaire. Peins uniquement la{" "}
                      <b>flèche</b> en rose, puis clique sur{" "}
                      <b>2. Sélection = flèche</b>. Le reste sera
                      automatiquement conservé comme traverse du groupe Palan.
                    </div>
                  ) : extractionInfo.stage === "separated" ? (
                    <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-950">
                      <b>{extractionInfo.name}</b> : {extractionInfo.triangles}{" "}
                      triangles sont maintenant rattachés au groupe <b>Palan</b>
                      , tandis que la flèche sélectionnée a été réintégrée au
                      groupe <b>Structure</b>. Masque le Palan pour vérifier le
                      résultat. Le preset est enregistré automatiquement dans le
                      navigateur et sera restauré après actualisation.
                      <button
                        type="button"
                        onClick={copyExtractionPreset}
                        className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-3 py-2.5 text-xs font-black text-white"
                      >
                        <Copy className="h-4 w-4" />
                        {copyState === "extraction"
                          ? "Preset d’extraction copié"
                          : "Copier le preset d’extraction"}
                      </button>
                    </div>
                  ) : null}
                  <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 p-3">
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-sky-800">
                      Extraction libre
                    </p>
                    <p className="mt-1 text-[11px] leading-relaxed text-sky-950">
                      Pour une petite pièce isolée comme le point de fixation,
                      peins-la en rose, donne-lui un nom et affecte-la
                      directement au bon groupe.
                    </p>
                    <div className="mt-3 rounded-xl border border-sky-200 bg-white px-3 py-2 text-[11px] font-bold text-sky-900">
                      Source active : <b>{selectedMesh ?? "mesh-022"}</b>
                      <span className="ml-2 font-normal text-slate-500">
                        Isole d’abord le mesh à découper.
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <input
                        value={freeExtractionName}
                        onChange={(event) => setFreeExtractionName(event.target.value)}
                        placeholder="Nom de la partie sélectionnée"
                        className="rounded-xl border border-sky-200 bg-white px-3 py-2 text-xs font-bold text-slate-900"
                      />
                      <select
                        value={freeExtractionGroup}
                        onChange={(event) => setFreeExtractionGroup(event.target.value as FunctionalGroupId)}
                        className="rounded-xl border border-sky-200 bg-white px-3 py-2 text-xs font-bold text-slate-900"
                      >
                        {FUNCTIONAL_GROUPS.map((group) => (
                          <option key={group.id} value={group.id}>{group.label}</option>
                        ))}
                      </select>
                      <input
                        value={freeExtractionRemainingName}
                        onChange={(event) => setFreeExtractionRemainingName(event.target.value)}
                        placeholder="Nom de la partie restante (optionnel)"
                        className="rounded-xl border border-violet-200 bg-white px-3 py-2 text-xs font-bold text-slate-900"
                      />
                      <select
                        value={freeExtractionRemainingGroup}
                        onChange={(event) => setFreeExtractionRemainingGroup(event.target.value as FunctionalGroupId)}
                        className="rounded-xl border border-violet-200 bg-white px-3 py-2 text-xs font-bold text-slate-900"
                      >
                        {FUNCTIONAL_GROUPS.map((group) => (
                          <option key={group.id} value={group.id}>{group.label}</option>
                        ))}
                      </select>
                    </div>
                    <p className="mt-2 text-[10px] leading-relaxed text-slate-600">
                      La partie rose est affectée au premier groupe. Tout ce qui reste dans le mesh source est automatiquement affecté au second groupe.
                    </p>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        disabled={
                          surfaceSelectionInfo.triangles === 0 ||
                          !freeExtractionName.trim() ||
                          extractionInfo.stage === "temporary"
                        }
                        onClick={() =>
                          setFreeExtractionKey((value) => value + 1)
                        }
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-700 px-3 py-2.5 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <ScanLine className="h-4 w-4" /> Extraire et affecter
                      </button>
                      <button
                        type="button"
                        disabled={freeExtractions.length === 0}
                        onClick={() =>
                          setResetFreeExtractionsKey((value) => value + 1)
                        }
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-sky-200 bg-white px-3 py-2.5 text-xs font-black text-sky-800 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <RotateCcw className="h-4 w-4" /> Réinitialiser les
                        extractions
                      </button>
                    </div>
                    {freeExtractions.length ? (
                      <div className="mt-3 space-y-1">
                        {freeExtractions.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between rounded-lg border border-sky-100 bg-white px-2.5 py-2 text-[11px]"
                          >
                            <span className="font-bold text-slate-800">
                              {item.name}
                            </span>
                            <span className="text-sky-700">
                              {FUNCTIONAL_GROUPS.find(
                                (group) => group.id === item.group,
                              )?.label ?? item.group}
                              {" · "}
                              {item.triangles} triangles
                              {item.remainingGroup
                                ? ` · reste → ${FUNCTIONAL_GROUPS.find((group) => group.id === item.remainingGroup)?.label ?? item.remainingGroup}`
                                : ""}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
                    Étape 1 : sélectionne largement <b>flèche + traverse</b>{" "}
                    puis crée la zone temporaire. Étape 2 : sur cette zone
                    isolée, sélectionne la <b>flèche</b>. La partie non
                    sélectionnée deviendra la traverse.
                  </p>
                </Section>

                <Section
                  title="Décomposition mesh-022"
                  open={openSections.decomposition}
                  onToggle={() =>
                    setOpenSections((s) => ({
                      ...s,
                      decomposition: !s.decomposition,
                    }))
                  }
                >
                  <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                    <b>{islands.length || "—"} îlots géométriques détectés.</b>{" "}
                    Isole-les pour trouver la petite traverse fusionnée dans la
                    potence.
                  </div>
                  <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
                    {islands.map((island) => {
                      const hidden = hiddenIslands.has(island.key);
                      const isolated = isolatedIsland === island.key;
                      return (
                        <div
                          key={island.key}
                          className={`rounded-xl border p-3 ${isolated ? "border-violet-400 bg-violet-50" : "border-slate-200 bg-slate-50"}`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <p className="text-xs font-black text-slate-950">
                                {island.key}
                              </p>
                              <p className="text-[10px] text-slate-500">
                                {island.triangles} triangles ·{" "}
                                {round(island.width, 1)} ×{" "}
                                {round(island.height, 1)} ×{" "}
                                {round(island.depth, 1)}
                              </p>
                            </div>
                          </div>
                          <div className="mt-2 grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => toggleIsland(island.key)}
                              className="rounded-lg border border-slate-200 bg-white py-2 text-xs font-bold"
                            >
                              {hidden ? (
                                <Eye className="mr-1 inline h-4 w-4" />
                              ) : (
                                <EyeOff className="mr-1 inline h-4 w-4" />
                              )}
                              {hidden ? "Afficher" : "Masquer"}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setIsolatedMesh(null);
                                setIsolatedGroup(null);
                                setIsolatedIsland((current) =>
                                  current === island.key ? null : island.key,
                                );
                              }}
                              className={`rounded-lg py-2 text-xs font-bold text-white ${isolated ? "bg-violet-700" : "bg-slate-950"}`}
                            >
                              <Crosshair className="mr-1 inline h-4 w-4" />
                              {isolated ? "Quitter" : "Isoler"}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setHiddenIslands(new Set());
                      setIsolatedIsland(null);
                    }}
                    className="mt-3 w-full rounded-xl border border-sky-200 bg-sky-50 py-2 text-xs font-black text-sky-800"
                  >
                    Réafficher tous les îlots
                  </button>
                </Section>

                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-700">
                        Qualification du modèle
                      </p>
                      <h2 className="mt-1 text-lg font-black text-slate-950">
                        {validatedCount} / {validationMeshes.length || 0} meshes
                        validés
                      </h2>
                      <p className="mt-1 text-xs text-slate-500">
                        Teste afficher, masquer, isoler, nommer et affecter
                        chaque pièce.
                      </p>
                    </div>
                    <div className="rounded-2xl bg-slate-950 px-3 py-2 text-center text-white">
                      <p className="text-xl font-black">{validationPercent}%</p>
                      <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                        certifié
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all"
                      style={{ width: `${validationPercent}%` }}
                    />
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[10px] font-black uppercase tracking-wide">
                    <div className="rounded-xl bg-emerald-50 px-2 py-2 text-emerald-700">
                      {validatedCount} validés
                    </div>
                    <div className="rounded-xl bg-amber-50 px-2 py-2 text-amber-700">
                      {reviewCount} à revoir
                    </div>
                    <div className="rounded-xl bg-slate-100 px-2 py-2 text-slate-600">
                      {Math.max(
                        validationMeshes.length - validatedCount - reviewCount,
                        0,
                      )}{" "}
                      en attente
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={selectNextPendingMesh}
                    className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-3 py-2.5 text-xs font-black text-white"
                  >
                    <ListChecks className="h-4 w-4" /> Tester le prochain mesh
                  </button>
                </div>

                <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-sky-700">
                        Mesh sélectionné
                      </p>
                      <p className="mt-1 font-black text-slate-950">
                        {selectedDescriptor?.key ?? "Aucun"}
                      </p>
                    </div>
                    {selectedDescriptor &&
                    selectedDescriptor.key !== ROOT_MESH_KEY ? (
                      <button
                        onClick={() => {
                          setIsolatedGroup(null);
                          setIsolatedMesh((c) =>
                            c === selectedDescriptor.key
                              ? null
                              : selectedDescriptor.key,
                          );
                        }}
                        className="rounded-xl bg-slate-950 px-3 py-2 text-xs font-bold text-white"
                      >
                        <Crosshair className="mr-1 inline h-4 w-4" />
                        {isolatedMesh === selectedDescriptor.key
                          ? "Quitter"
                          : "Isoler"}
                      </button>
                    ) : selectedDescriptor ? (
                      <span className="inline-flex items-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700">
                        <ShieldCheck className="h-4 w-4" /> Racine protégée
                      </span>
                    ) : null}
                  </div>
                  <label className="mt-3 block text-xs font-bold text-slate-600">
                    Nom métier
                  </label>
                  <div className="mt-2 flex gap-2">
                    <input
                      value={
                        selectedDescriptor?.key === ROOT_MESH_KEY
                          ? "Assemblage complet — racine protégée"
                          : draftName
                      }
                      disabled={selectedDescriptor?.key === ROOT_MESH_KEY}
                      onChange={(e) => setDraftName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveMapping();
                      }}
                      className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold disabled:bg-slate-100 disabled:text-slate-500"
                      placeholder="Ex. Butée réglable"
                    />
                    <button
                      disabled={selectedDescriptor?.key === ROOT_MESH_KEY}
                      onClick={saveMapping}
                      className="rounded-xl bg-sky-700 px-3 py-2 text-xs font-black text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                      <Save className="h-4 w-4" />
                    </button>
                  </div>
                  {selectedDescriptor ? (
                    <div className="mt-4 border-t border-sky-200 pt-4">
                      <div className="grid grid-cols-2 gap-2">
                        <label className="text-xs font-bold text-slate-600">
                          Affectation
                          <select
                            value={
                              meshValidation[selectedDescriptor.key]?.group ??
                              "unassigned"
                            }
                            onChange={(event) =>
                              updateMeshValidation(selectedDescriptor.key, {
                                group: event.target
                                  .value as MeshValidationGroup,
                              })
                            }
                            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800"
                          >
                            <option value="unassigned">À définir</option>
                            {FUNCTIONAL_GROUPS.map((group) => (
                              <option key={group.id} value={group.id}>
                                {group.label}
                              </option>
                            ))}
                            <option value="ignore">À ignorer / parasite</option>
                          </select>
                        </label>
                        <label className="text-xs font-bold text-slate-600">
                          Statut
                          <select
                            value={
                              meshValidation[selectedDescriptor.key]?.status ??
                              "pending"
                            }
                            onChange={(event) =>
                              updateMeshValidation(selectedDescriptor.key, {
                                status: event.target
                                  .value as MeshValidationStatus,
                              })
                            }
                            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800"
                          >
                            <option value="pending">En attente</option>
                            <option value="review">À revoir</option>
                            <option value="validated">Validé</option>
                          </select>
                        </label>
                      </div>
                      <label className="mt-3 block text-xs font-bold text-slate-600">
                        Note de contrôle
                      </label>
                      <div className="mt-1 flex gap-2">
                        <input
                          value={draftValidationNote}
                          onChange={(event) =>
                            setDraftValidationNote(event.target.value)
                          }
                          onKeyDown={(event) => {
                            if (event.key === "Enter") saveValidationNote();
                          }}
                          placeholder="Ex. points blancs parasites, à exclure"
                          className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold"
                        />
                        <button
                          type="button"
                          onClick={saveValidationNote}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700"
                        >
                          <Save className="h-4 w-4" />
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          saveMapping();
                          updateMeshValidation(selectedDescriptor.key, {
                            status: "validated",
                            note: draftValidationNote.trim(),
                          });
                          selectNextPendingMesh();
                        }}
                        className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-2.5 text-xs font-black text-white"
                      >
                        <BadgeCheck className="h-4 w-4" /> Valider et passer au
                        suivant
                      </button>
                    </div>
                  ) : null}
                </div>

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Rechercher un mesh…"
                    className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm"
                  />
                </div>
                <div className="grid grid-cols-4 gap-1 rounded-xl bg-slate-100 p-1">
                  {(
                    [
                      ["all", "Tous"],
                      ["pending", "Attente"],
                      ["review", "À revoir"],
                      ["validated", "Validés"],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setValidationFilter(value)}
                      className={`rounded-lg px-2 py-2 text-[10px] font-black ${
                        validationFilter === value
                          ? "bg-white text-slate-950 shadow-sm"
                          : "text-slate-500"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="flex justify-between text-xs text-slate-500">
                  <span>
                    {filteredMeshes.length} affichés · {namedCount}/
                    {meshes.length} identifiés
                  </span>
                  <button
                    onClick={showAllMeshes}
                    className="font-bold text-sky-700"
                  >
                    Tout réafficher
                  </button>
                </div>
                <div className="space-y-2">
                  {filteredMeshes.map((mesh) => {
                    const hidden = hiddenMeshes.has(mesh.key),
                      selected = selectedMesh === mesh.key,
                      isRoot = mesh.key === ROOT_MESH_KEY,
                      name = isRoot
                        ? "Assemblage complet — racine protégée"
                        : meshMapping[mesh.key]?.trim();
                    return (
                      <div
                        key={mesh.key}
                        className={`rounded-2xl border p-3 ${selected ? "border-sky-500 bg-sky-50" : isRoot ? "border-emerald-200 bg-emerald-50/60" : "border-slate-200"}`}
                      >
                        <button
                          onClick={() => setSelectedMesh(mesh.key)}
                          className="w-full text-left"
                        >
                          <div className="flex justify-between">
                            <div>
                              <p className="text-sm font-black">{mesh.key}</p>
                              <p
                                className={`text-xs ${isRoot ? "font-bold text-emerald-700" : name ? "text-sky-700" : "text-slate-400"}`}
                              >
                                {name || "Nom métier à définir"}
                              </p>
                            </div>
                            {isRoot ? (
                              <ShieldCheck className="h-4 w-4 text-emerald-600" />
                            ) : meshValidation[mesh.key]?.status ===
                              "validated" ? (
                              <BadgeCheck className="h-5 w-5 text-emerald-600" />
                            ) : meshValidation[mesh.key]?.status ===
                              "review" ? (
                              <CircleAlert className="h-5 w-5 text-amber-500" />
                            ) : name ? (
                              <Check className="h-4 w-4 text-sky-600" />
                            ) : null}
                          </div>
                        </button>
                        {isRoot ? (
                          <div className="mt-2 rounded-xl border border-emerald-200 bg-white/70 px-3 py-2 text-center text-xs font-bold text-emerald-700">
                            Racine de l’assemblage · actions désactivées
                          </div>
                        ) : (
                          <>
                            <div className="mt-2 flex flex-wrap gap-1 text-[9px] font-black uppercase tracking-wide">
                              <span
                                className={`rounded-full px-2 py-1 ${
                                  meshValidation[mesh.key]?.status ===
                                  "validated"
                                    ? "bg-emerald-100 text-emerald-700"
                                    : meshValidation[mesh.key]?.status ===
                                        "review"
                                      ? "bg-amber-100 text-amber-700"
                                      : "bg-slate-100 text-slate-500"
                                }`}
                              >
                                {meshValidation[mesh.key]?.status ===
                                "validated"
                                  ? "Validé"
                                  : meshValidation[mesh.key]?.status ===
                                      "review"
                                    ? "À revoir"
                                    : "En attente"}
                              </span>
                              <span className="rounded-full bg-sky-50 px-2 py-1 text-sky-700">
                                {meshValidation[mesh.key]?.group === "ignore"
                                  ? "Parasite"
                                  : (FUNCTIONAL_GROUPS.find(
                                      (group) =>
                                        group.id ===
                                        meshValidation[mesh.key]?.group,
                                    )?.label ?? "Groupe à définir")}
                              </span>
                            </div>
                            <div className="mt-2 flex gap-2">
                              <button
                                onClick={() => toggleMesh(mesh.key)}
                                className="flex-1 rounded-xl border border-slate-200 py-2 text-xs font-bold"
                              >
                                {hidden ? (
                                  <Eye className="mr-1 inline h-4 w-4" />
                                ) : (
                                  <EyeOff className="mr-1 inline h-4 w-4" />
                                )}
                                {hidden ? "Afficher" : "Masquer"}
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedMesh(mesh.key);
                                  setIsolatedGroup(null);
                                  setIsolatedMesh((c) =>
                                    c === mesh.key ? null : mesh.key,
                                  );
                                }}
                                className="flex-1 rounded-xl bg-slate-950 py-2 text-xs font-bold text-white"
                              >
                                <Crosshair className="mr-1 inline h-4 w-4" />
                                {isolatedMesh === mesh.key
                                  ? "Quitter"
                                  : "Isoler"}
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="border-t border-slate-200 bg-slate-50 p-4">
                <button
                  type="button"
                  disabled={extractionInfo.stage === "idle" && freeExtractions.length === 0}
                  onClick={copyExtractionPreset}
                  className="mb-2 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-4 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Copy className="h-4 w-4" />
                  {copyState === "extraction"
                    ? "Preset d’extraction copié"
                    : "Copier le preset d’extraction"}
                </button>
                <button
                  onClick={copyMapping}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white"
                >
                  <Copy className="h-4 w-4" />
                  {copyState === "mapping"
                    ? "JSON copié"
                    : "Copier la cartographie JSON"}
                </button>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-xl bg-white p-2">
                    <Box className="mx-auto h-4 w-4 text-sky-700" />
                    <b>{stats.meshes || "—"}</b>
                    <p className="text-slate-400">Meshes</p>
                  </div>
                  <div className="rounded-xl bg-white p-2">
                    <Cpu className="mx-auto h-4 w-4 text-sky-700" />
                    <b>{stats.materials || "—"}</b>
                    <p className="text-slate-400">Matériaux</p>
                  </div>
                  <div className="rounded-xl bg-white p-2">
                    <ScanLine className="mx-auto h-4 w-4 text-sky-700" />
                    <b>{validatedCount}</b>
                    <p className="text-slate-400">Validés</p>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </div>
        <div className="mt-5 rounded-3xl bg-slate-950 p-5 text-white">
          <div className="grid gap-3 text-sm text-slate-300 sm:grid-cols-3">
            <div>
              <RotateCcw className="mr-2 inline h-4 w-4 text-sky-300" />
              Clic gauche : rotation libre
            </div>
            <div>
              <ZoomIn className="mr-2 inline h-4 w-4 text-sky-300" />
              Molette : zoom vers le curseur
            </div>
            <div>
              <MousePointer2 className="mr-2 inline h-4 w-4 text-sky-300" />
              Clic droit ou molette : déplacer · Double-clic : cibler
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

useGLTF.preload(PFI_MODEL_PATH);
