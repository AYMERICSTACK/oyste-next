"use client";

import { useEffect, useMemo } from "react";
import { ContactShadows, Environment, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import type { ConfiguratorMeshGroups, ConfiguratorModelPreset, ConfiguratorModuleGroup, LabFreeExtraction } from "@/lib/configurator/model-types";
import type { EngineResult } from "@/lib/configurator/types";

export type ConfiguratorModelDimensions = {
  width: number;
  height: number;
  depth: number;
};

export type ConfiguratorMeshDebugItem = {
  id: string;
  index: number;
  name: string;
  nodeName: string;
  materialName: string;
  triangles: number;
};

export type ConfiguratorMeshComponentItem = {
  id: string;
  meshId: string;
  index: number;
  triangles: number;
  width: number;
  height: number;
  depth: number;
  tiny: boolean;
};

type PreparedModel = {
  model: THREE.Object3D;
  meshes: ConfiguratorMeshDebugItem[];
};

function triangleCount(geometry: THREE.BufferGeometry) {
  return geometry.index
    ? Math.floor(geometry.index.count / 3)
    : Math.floor((geometry.attributes.position?.count ?? 0) / 3);
}

function geometryFromTriangles(
  source: THREE.BufferGeometry,
  selectedTriangles: ReadonlySet<number>,
) {
  const position = source.getAttribute("position");
  if (!position) return { selected: null, remaining: null };

  const sourceIndex = source.getIndex();
  const count = sourceIndex ? sourceIndex.count / 3 : position.count / 3;
  const selectedIndices: number[] = [];
  const remainingIndices: number[] = [];
  const vertexAt = (offset: number) =>
    sourceIndex ? sourceIndex.getX(offset) : offset;

  for (let triangle = 0; triangle < count; triangle += 1) {
    const offset = triangle * 3;
    const target = selectedTriangles.has(triangle)
      ? selectedIndices
      : remainingIndices;
    target.push(vertexAt(offset), vertexAt(offset + 1), vertexAt(offset + 2));
  }

  const create = (indices: number[]) => {
    if (!indices.length) return null;
    const geometry = source.clone();
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    return geometry;
  };

  return {
    selected: create(selectedIndices),
    remaining: create(remainingIndices),
  };
}

function splitGeometryComponents(source: THREE.BufferGeometry) {
  const position = source.getAttribute("position");
  if (!position)
    return [] as {
      triangles: number[];
      indices: number[];
      size: THREE.Vector3;
    }[];

  const index = source.getIndex();
  const triangleCount = index
    ? Math.floor(index.count / 3)
    : Math.floor(position.count / 3);
  const vertexAt = (offset: number) => (index ? index.getX(offset) : offset);

  // Keep this topology algorithm strictly identical to the 3D Lab island
  // inspector. Component numbers saved by the Lab (component-007, -008, ...)
  // must point to the same geometry in the production configurator.
  const parent = new Int32Array(position.count);
  const rank = new Uint8Array(position.count);
  for (let vertex = 0; vertex < parent.length; vertex += 1) {
    parent[vertex] = vertex;
  }

  const find = (value: number) => {
    let current = value;
    while (parent[current] !== current) {
      parent[current] = parent[parent[current]];
      current = parent[current];
    }
    return current;
  };

  const union = (left: number, right: number) => {
    let rootLeft = find(left);
    let rootRight = find(right);
    if (rootLeft === rootRight) return;
    if (rank[rootLeft] < rank[rootRight]) {
      [rootLeft, rootRight] = [rootRight, rootLeft];
    }
    parent[rootRight] = rootLeft;
    if (rank[rootLeft] === rank[rootRight]) rank[rootLeft] += 1;
  };

  for (let triangle = 0; triangle < triangleCount; triangle += 1) {
    const offset = triangle * 3;
    const a = vertexAt(offset);
    const b = vertexAt(offset + 1);
    const c = vertexAt(offset + 2);
    union(a, b);
    union(b, c);
  }

  const trianglesByRoot = new Map<number, number[]>();
  for (let triangle = 0; triangle < triangleCount; triangle += 1) {
    const root = find(vertexAt(triangle * 3));
    const triangles = trianglesByRoot.get(root) ?? [];
    triangles.push(triangle);
    trianglesByRoot.set(root, triangles);
  }

  return [...trianglesByRoot.values()]
    .map((triangles) => {
      const indices: number[] = [];
      const box = new THREE.Box3();
      const point = new THREE.Vector3();

      triangles.forEach((triangle) => {
        const offset = triangle * 3;
        for (let corner = 0; corner < 3; corner += 1) {
          const vertex = vertexAt(offset + corner);
          indices.push(vertex);
          point.fromBufferAttribute(position, vertex);
          box.expandByPoint(point);
        }
      });

      const size = new THREE.Vector3();
      box.getSize(size);
      return { triangles, indices, size };
    })
    .sort((left, right) => right.triangles.length - left.triangles.length);
}

function removeTinyGeometryIslands(
  source: THREE.BufferGeometry,
  minimumTriangles = 12,
) {
  const position = source.getAttribute("position");
  if (!position) return source;

  const index = source.getIndex();
  const triangleCount = index
    ? Math.floor(index.count / 3)
    : Math.floor(position.count / 3);
  if (!triangleCount) return source;

  const vertexAt = (offset: number) => (index ? index.getX(offset) : offset);
  const trianglesByVertex = new Map<string, number[]>();
  const triangleVertices: string[][] = new Array(triangleCount);
  const precision = 100000;

  const keyForVertex = (vertexIndex: number) => {
    const x = Math.round(position.getX(vertexIndex) * precision);
    const y = Math.round(position.getY(vertexIndex) * precision);
    const z = Math.round(position.getZ(vertexIndex) * precision);
    return `${x}:${y}:${z}`;
  };

  for (let triangle = 0; triangle < triangleCount; triangle += 1) {
    const offset = triangle * 3;
    const keys = [
      keyForVertex(vertexAt(offset)),
      keyForVertex(vertexAt(offset + 1)),
      keyForVertex(vertexAt(offset + 2)),
    ];
    triangleVertices[triangle] = keys;
    keys.forEach((key) => {
      const connected = trianglesByVertex.get(key) ?? [];
      connected.push(triangle);
      trianglesByVertex.set(key, connected);
    });
  }

  const visited = new Uint8Array(triangleCount);
  const components: number[][] = [];

  for (let start = 0; start < triangleCount; start += 1) {
    if (visited[start]) continue;
    const component: number[] = [];
    const queue = [start];
    visited[start] = 1;

    while (queue.length) {
      const triangle = queue.pop()!;
      component.push(triangle);
      triangleVertices[triangle].forEach((key) => {
        trianglesByVertex.get(key)?.forEach((neighbor) => {
          if (visited[neighbor]) return;
          visited[neighbor] = 1;
          queue.push(neighbor);
        });
      });
    }

    components.push(component);
  }

  const kept = components.filter(
    (component) => component.length >= minimumTriangles,
  );
  if (!kept.length || kept.length === components.length) return source;

  const keptIndices: number[] = [];
  kept.flat().forEach((triangle) => {
    const offset = triangle * 3;
    keptIndices.push(
      vertexAt(offset),
      vertexAt(offset + 1),
      vertexAt(offset + 2),
    );
  });

  const cleaned = source.clone();
  cleaned.setIndex(keptIndices);
  cleaned.computeVertexNormals();
  cleaned.computeBoundingBox();
  cleaned.computeBoundingSphere();
  source.dispose();
  return cleaned;
}

function addGeneratedMesh(
  parent: THREE.Object3D,
  source: THREE.Mesh,
  geometry: THREE.BufferGeometry,
  id: string,
  group: "structure" | "hoist",
) {
  const generated = new THREE.Mesh(geometry, source.material);
  generated.name = id;
  generated.userData.configuratorDebugId = id;
  generated.userData.configuratorOriginalGeometry = geometry.clone();
  generated.userData.configuratorGroup = group;
  generated.castShadow = source.castShadow;
  generated.receiveShadow = source.receiveShadow;
  generated.position.copy(source.position);
  generated.quaternion.copy(source.quaternion);
  generated.scale.copy(source.scale);
  parent.add(generated);
  return generated;
}

function findMeshByDebugId(
  model: THREE.Object3D,
  debugId: string,
): THREE.Mesh | null {
  let found: THREE.Mesh | null = null;
  model.traverse((object) => {
    if (found || !(object instanceof THREE.Mesh)) return;
    if (
      object.userData.configuratorDebugId === debugId ||
      object.userData.configuratorSourceMeshId === debugId
    ) {
      found = object;
    }
  });
  return found as THREE.Mesh | null;
}

function applyLabFreeExtractions(
  model: THREE.Object3D,
  records: readonly LabFreeExtraction[],
  groups: ConfiguratorMeshGroups,
  idPrefix?: string,
) {
  const ordered = [...records].sort((left, right) =>
    left.updatedAt.localeCompare(right.updatedAt),
  );

  ordered.forEach((record) => {
    const sourceMesh = findMeshByDebugId(model, record.sourceMesh);
    if (!sourceMesh?.parent || !record.indices.length) return;

    const geometry = sourceMesh.geometry;
    const position = geometry.getAttribute("position");
    if (!position) return;
    const index = geometry.getIndex();
    const count = index ? Math.floor(index.count / 3) : Math.floor(position.count / 3);
    const vertexAt = (offset: number) => (index ? index.getX(offset) : offset);
    const signatures = new Set<string>();
    for (let offset = 0; offset < record.indices.length; offset += 3) {
      signatures.add(`${record.indices[offset]}:${record.indices[offset + 1]}:${record.indices[offset + 2]}`);
    }

    const selected: number[] = [];
    const remaining: number[] = [];
    for (let triangle = 0; triangle < count; triangle += 1) {
      const offset = triangle * 3;
      const a = vertexAt(offset);
      const b = vertexAt(offset + 1);
      const c = vertexAt(offset + 2);
      (signatures.has(`${a}:${b}:${c}`) ? selected : remaining).push(a, b, c);
    }
    if (!selected.length || !remaining.length) return;

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
    sourceMesh.userData.configuratorOriginalGeometry?.dispose?.();
    sourceMesh.userData.configuratorOriginalGeometry = remainingGeometry.clone();
    sourceMesh.userData.configuratorGroup =
      resolveMeshGroup(record.sourceMesh, groups) ??
      resolveLabGroup(record.remainingGroup);

    const extracted = new THREE.Mesh(extractedGeometry, sourceMesh.material);
    const extractedId = idPrefix ? `${idPrefix}:${record.id}` : record.id;
    extracted.name = extractedId;
    extracted.userData.configuratorDebugId = extractedId;
    extracted.userData.configuratorSourceMeshId = record.sourceMesh;
    extracted.userData.configuratorOriginalGeometry = extractedGeometry.clone();
    extracted.userData.configuratorGroup =
      resolveMeshGroup(record.id, groups) ?? resolveLabGroup(record.group);
    extracted.castShadow = sourceMesh.castShadow;
    extracted.receiveShadow = sourceMesh.receiveShadow;
    extracted.position.copy(sourceMesh.position);
    extracted.quaternion.copy(sourceMesh.quaternion);
    extracted.scale.copy(sourceMesh.scale);
    sourceMesh.parent.add(extracted);
  });
}

function resolveLabGroup(group?: string): ConfiguratorModuleGroup | undefined {
  if (group === "potence" || group === "structure") return "structure";
  if (group === "palan" || group === "hoist") return "hoist";
  if (group === "chariot-manuel" || group === "trolley") return "trolley";
  if (group === "powerSupply") return "powerSupply";
  if (group === "mainSwitch") return "mainSwitch";
  if (group === "ignore") return "ignore";
  return undefined;
}

function resolveMeshGroup(
  meshId: string,
  groups: ConfiguratorMeshGroups,
): ConfiguratorModuleGroup | undefined {
  const entries = Object.entries(groups) as Array<
    [ConfiguratorModuleGroup, readonly string[] | undefined]
  >;
  return entries.find(([, meshIds]) => meshIds?.includes(meshId))?.[0];
}

function prepareModel(
  source: THREE.Object3D,
  groups: ConfiguratorMeshGroups,
  options?: {
    idPrefix?: string;
    includeMeshes?: ReadonlySet<string>;
    forcedGroup?: ConfiguratorModuleGroup;
    freeExtractions?: readonly LabFreeExtraction[];
    allowedGroups?: ReadonlySet<ConfiguratorModuleGroup>;
  },
): PreparedModel {
  const cloned = source.clone(true);
  const meshes: ConfiguratorMeshDebugItem[] = [];
  let meshIndex = 0;

  cloned.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;

    meshIndex += 1;
    const sourceId = `mesh-${String(meshIndex).padStart(3, "0")}`;
    const id = options?.idPrefix
      ? `${options.idPrefix}:${sourceId}`
      : sourceId;

    if (options?.includeMeshes && !options.includeMeshes.has(sourceId)) {
      if (sourceId === "mesh-001") {
        const emptyRoot = (mesh.geometry as THREE.BufferGeometry).clone();
        emptyRoot.setIndex([]);
        emptyRoot.computeBoundingBox();
        emptyRoot.computeBoundingSphere();
        mesh.geometry = emptyRoot;
        mesh.visible = true;
      } else {
        mesh.visible = false;
      }
      return;
    }
    const geometry = mesh.geometry as THREE.BufferGeometry;
    const material = Array.isArray(mesh.material)
      ? mesh.material[0]
      : mesh.material;

    mesh.geometry = geometry.clone();

    mesh.userData.configuratorOriginalGeometry = mesh.geometry.clone();
    mesh.userData.configuratorDebugId = id;
    mesh.userData.configuratorSourceMeshId = sourceId;
    mesh.userData.configuratorGroup =
      options?.forcedGroup ?? resolveMeshGroup(sourceId, groups);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    if (sourceId === "mesh-001") {
      mesh.userData.originalDrawRange = {
        start: mesh.geometry.drawRange.start,
        count: mesh.geometry.drawRange.count,
      };
    }

    meshes.push({
      id,
      index: meshIndex,
      name: mesh.name || `Mesh ${meshIndex}`,
      nodeName: mesh.parent?.name || "Sans nom",
      materialName: material?.name || "Sans nom",
      triangles: triangleCount(mesh.geometry),
    });
  });

  applyLabFreeExtractions(
    cloned,
    options?.freeExtractions ?? [],
    groups,
    options?.idPrefix,
  );

  // Presets can clone, split and re-parent geometry. Refresh every volume used
  // by Three.js after those operations, then disable frustum culling for this
  // modest production assembly. This prevents the hoist, hook and accessories
  // from disappearing at close zoom levels or specific viewing angles.
  cloned.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;

    // Rebuild materials after geometry extraction so only the actual potence
    // structure receives the brand yellow. Switches, power supply, trolley,
    // hoist and other extracted options retain their source colors.
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const preparedMaterials = materials.map((sourceMaterial) => {
      const clonedMaterial = sourceMaterial?.clone?.() as THREE.Material | undefined;
      if (!clonedMaterial) {
        return new THREE.MeshStandardMaterial({
          color: mesh.userData.configuratorGroup === "structure" ? "#dca600" : "#64748b",
          roughness: 0.62,
          metalness: 0.08,
        });
      }

      if (clonedMaterial instanceof THREE.MeshStandardMaterial) {
        clonedMaterial.roughness = 0.58;
        clonedMaterial.metalness = Math.min(clonedMaterial.metalness ?? 0, 0.35);
        if (mesh.userData.configuratorGroup === "structure") {
          clonedMaterial.color.set("#dca600");
        }
      }
      return clonedMaterial;
    });
    mesh.material = Array.isArray(mesh.material) ? preparedMaterials : preparedMaterials[0];

    mesh.geometry.computeBoundingBox();
    mesh.geometry.computeBoundingSphere();
    mesh.frustumCulled = false;
  });

  cloned.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    const id = mesh.userData.configuratorDebugId as string | undefined;
    const group = mesh.userData.configuratorGroup as ConfiguratorModuleGroup | undefined;
    if (!id) return;

    if (options?.allowedGroups && (!group || !options.allowedGroups.has(group))) {
      mesh.userData.configuratorGroup = "ignore";
      if (id === "mesh-001" || id.endsWith(":mesh-001")) {
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        materials.forEach((material) => { if (material) material.visible = false; });
        mesh.geometry.setDrawRange(0, 0);
      } else {
        mesh.visible = false;
      }
    }

    if (!meshes.some((item) => item.id === id)) {
      meshes.push({
        id,
        index: meshes.length + 1,
        name: mesh.name,
        nodeName: mesh.parent?.name || "Sans nom",
        materialName: "Extraction 3D Lab",
        triangles: triangleCount(mesh.geometry),
      });
    }
  });

  return { model: cloned, meshes };
}

export default function Configurator3DScene({
  preset,
  onDimensions,
  onMeshes,
  hiddenMeshIds,
  isolatedMeshId,
  inspectedMeshId,
  hiddenComponentIds,
  isolatedComponentId,
  onComponents,
  configuration,
}: {
  preset: ConfiguratorModelPreset;
  onDimensions: (dimensions: ConfiguratorModelDimensions) => void;
  onMeshes?: (meshes: ConfiguratorMeshDebugItem[]) => void;
  hiddenMeshIds?: ReadonlySet<string>;
  isolatedMeshId?: string | null;
  inspectedMeshId?: string | null;
  hiddenComponentIds?: ReadonlySet<string>;
  isolatedComponentId?: string | null;
  onComponents?: (components: ConfiguratorMeshComponentItem[]) => void;
  configuration: EngineResult;
}) {
  const gltf = useGLTF(preset.path);
  const modulePath = preset.modules?.[0]?.source.path ?? preset.path;
  const moduleGltf = useGLTF(modulePath);

  const { model, scale, dimensions, meshes } = useMemo(() => {
    const preparedBase = prepareModel(gltf.scene, preset.meshGroups, {
      freeExtractions: preset.freeExtractions,
    });
    const assembly = new THREE.Group();
    assembly.name = `assembly:${preset.id}`;
    assembly.add(preparedBase.model);

    const allMeshes = [...preparedBase.meshes];
    preset.modules?.forEach((modulePreset) => {
      const moduleSource =
        modulePreset.source.path === preset.path ? gltf.scene : moduleGltf.scene;
      const moduleGroups = Object.fromEntries(
        Object.entries(modulePreset.source.groups).map(([key, definition]) => [
          resolveLabGroup(key),
          definition.meshes,
        ]).filter(([key]) => Boolean(key)),
      ) as ConfiguratorMeshGroups;
      const preparedModule = prepareModel(moduleSource, moduleGroups, {
        idPrefix: `module-${modulePreset.id}`,
        freeExtractions: modulePreset.source.freeExtractions,
        allowedGroups: new Set(modulePreset.groups),
      });
      preparedModule.model.name = `module:${modulePreset.id}`;
      assembly.add(preparedModule.model);
      allMeshes.push(...preparedModule.meshes);
    });

    const orientedModel = new THREE.Group();
    const [rotationX, rotationY, rotationZ] = preset.rotation.map(
      THREE.MathUtils.degToRad,
    );

    assembly.rotation.set(rotationX, rotationY, rotationZ);
    orientedModel.add(assembly);
    orientedModel.updateMatrixWorld(true);

    const box = new THREE.Box3().setFromObject(orientedModel);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    const maxDimension = Math.max(size.x, size.y, size.z, 1);
    const normalizedScale = (6.2 / maxDimension) * preset.scale;
    orientedModel.position.set(-center.x, -box.min.y, -center.z);
    orientedModel.updateMatrixWorld(true);

    return {
      model: orientedModel,
      scale: normalizedScale,
      meshes: allMeshes,
      dimensions: {
        width: size.x * normalizedScale,
        height: size.y * normalizedScale,
        depth: size.z * normalizedScale,
      },
    };
  }, [gltf.scene, moduleGltf.scene, preset]);

  useEffect(() => onDimensions(dimensions), [dimensions, onDimensions]);
  useEffect(() => onMeshes?.(meshes), [meshes, onMeshes]);

  useEffect(() => {
    if (!inspectedMeshId) {
      onComponents?.([]);
      return;
    }

    const inspected = findMeshByDebugId(model, inspectedMeshId);
    if (!inspected) {
      onComponents?.([]);
      return;
    }

    const original =
      (inspected.userData.configuratorOriginalGeometry as
        THREE.BufferGeometry | undefined) ?? inspected.geometry;
    const components = splitGeometryComponents(original);
    inspected.userData.configuratorComponents = components;
    onComponents?.(
      components.map((component, index) => ({
        id: `${inspectedMeshId}:component-${String(index + 1).padStart(3, "0")}`,
        meshId: inspectedMeshId,
        index: index + 1,
        triangles: component.triangles.length,
        width: component.size.x,
        height: component.size.y,
        depth: component.size.z,
        tiny: component.triangles.length < 20,
      })),
    );
  }, [inspectedMeshId, model, onComponents]);

  useEffect(() => {
    model.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      const id = mesh.userData.configuratorDebugId as string | undefined;
      const original = mesh.userData.configuratorOriginalGeometry as
        THREE.BufferGeometry | undefined;
      if (!id || !original || id === "mesh-001") return;

      if (id !== inspectedMeshId) {
        if (mesh.geometry !== original) {
          mesh.geometry.dispose();
          mesh.geometry = original.clone();
        }
        return;
      }

      const components =
        (mesh.userData.configuratorComponents as
          ReturnType<typeof splitGeometryComponents> | undefined) ??
        splitGeometryComponents(original);
      mesh.userData.configuratorComponents = components;
      const keptIndices: number[] = [];
      components.forEach((component, index) => {
        const componentId = `${id}:component-${String(index + 1).padStart(3, "0")}`;
        const keep = isolatedComponentId
          ? componentId === isolatedComponentId
          : !hiddenComponentIds?.has(componentId);
        if (keep) keptIndices.push(...component.indices);
      });

      const next = original.clone();
      next.setIndex(keptIndices);
      next.computeVertexNormals();
      next.computeBoundingBox();
      next.computeBoundingSphere();
      mesh.geometry.dispose();
      mesh.geometry = next;
      mesh.frustumCulled = false;
    });
  }, [
    hiddenComponentIds,
    inspectedMeshId,
    isolatedComponentId,
    model,
  ]);

  useEffect(() => {
    // The hoist only appears once the customer explicitly chooses a hoist.
    // Reaching an upcoming step must never reveal equipment in advance.
    const selectedValues = (id: string) => {
      const value = configuration.answers[id];
      return Array.isArray(value) ? value : value ? [value] : [];
    };

    const electricalOptions = selectedValues("electricalOptions");
    const hoistType = selectedValues("hoistType")[0];
    const showHoist = Boolean(hoistType);
    const showPowerSupply =
      electricalOptions.some((value) =>
        /ligne|alimentation|rail/i.test(value),
      ) || hoistType === "electric";
    const showMainSwitch = electricalOptions.includes(
      "interrupteur-cadenassable",
    );

    model.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      const id = mesh.userData.configuratorDebugId as string | undefined;
      if (!id) return;

      const group = mesh.userData.configuratorGroup as
        | ConfiguratorModuleGroup
        | undefined;
      let progressiveVisible =
        group === "structure" || group === "trolley" || !group;
      if (group === "hoist") progressiveVisible = showHoist;
      if (group === "powerSupply") progressiveVisible = showPowerSupply;
      if (group === "mainSwitch") progressiveVisible = showMainSwitch;
      if (group === "ignore") progressiveVisible = false;

      const sourceMeshId = mesh.userData.configuratorSourceMeshId as
        | string
        | undefined;
      if (id === "mesh-001" && sourceMeshId === "mesh-001") {
        mesh.visible = true;
        const showRootGeometry = isolatedMeshId
          ? isolatedMeshId === id
          : progressiveVisible && !hiddenMeshIds?.has(id);
        const materials = Array.isArray(mesh.material)
          ? mesh.material
          : [mesh.material];
        materials.forEach((material) => {
          if (material) material.visible = showRootGeometry;
        });
        const original = mesh.userData.originalDrawRange as
          { start: number; count: number } | undefined;
        mesh.geometry.setDrawRange(
          showRootGeometry ? (original?.start ?? 0) : 0,
          showRootGeometry ? (original?.count ?? Infinity) : 0,
        );
        return;
      }

      mesh.visible = isolatedMeshId
        ? id === isolatedMeshId
        : progressiveVisible && !hiddenMeshIds?.has(id);
    });
  }, [configuration, hiddenMeshIds, isolatedMeshId, model]);

  return (
    <>
      <group scale={scale} position={preset.position}>
        <primitive object={model} />
      </group>
      <ContactShadows
        position={[0, -0.02, 0]}
        opacity={0.24}
        scale={10}
        blur={2.5}
        far={6}
      />
      <Environment preset="warehouse" />
    </>
  );
}
