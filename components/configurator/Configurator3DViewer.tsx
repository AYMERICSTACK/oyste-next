"use client";

import {
  Suspense,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { Html, OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import {
  ArrowDown,
  ArrowUp,
  Box,
  Boxes,
  Check,
  Copy,
  Crosshair,
  Eye,
  EyeOff,
  Layers3,
  RotateCcw,
  Scan,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import * as THREE from "three";
import type { EngineResult } from "@/lib/configurator/types";
import { getConfiguratorModel } from "@/lib/configurator/model-registry";
import type {
  Configurator3DState,
  ConfiguratorCameraPreset,
  ConfiguratorModelFamily,
} from "@/lib/configurator/model-types";
import Configurator3DOverlay from "./Configurator3DOverlay";
import Configurator3DScene, {
  type ConfiguratorMeshComponentItem,
  type ConfiguratorMeshDebugItem,
  type ConfiguratorModelDimensions,
} from "./Configurator3DScene";

const INITIAL_DIMENSIONS: ConfiguratorModelDimensions = {
  width: 1,
  height: 1,
  depth: 1,
};

const FAMILY_LABELS: Record<string, string> = {
  PFI: "Potence sur fût inversée",
  PFT: "Potence sur fût triangulée",
  PMI: "Potence murale inversée",
  PMT: "Potence murale triangulée",
  PMA: "Potence murale articulée",
  PMAM: "Potence murale articulée motorisée",
};

function getAnswerValue(configuration: EngineResult, id: string) {
  const value = configuration.answers[id];
  return typeof value === "string" ? value : undefined;
}

function getAnswerLabel(configuration: EngineResult, id: string) {
  const value = getAnswerValue(configuration, id);
  const question = configuration.questions.find((item) => item.id === id);
  return question?.choices.find((choice) => choice.id === value)?.label;
}

function build3DState(configuration: EngineResult): Configurator3DState {
  const craneType = getAnswerValue(configuration, "potenceType") as
    ConfiguratorModelFamily | undefined;
  const optionIds = [
    "mechanicalOptions",
    "electricalOptions",
    "outsideOptions",
  ];
  const options = optionIds.flatMap((id) => {
    const value = configuration.answers[id];
    const question = configuration.questions.find((item) => item.id === id);
    if (!Array.isArray(value)) return [];
    return (
      question?.choices
        .filter((choice) => value.includes(choice.id))
        .map((choice) => choice.label) ?? []
    );
  });

  return {
    craneType,
    capacity: getAnswerLabel(configuration, "capacity"),
    reach: getAnswerLabel(configuration, "reach"),
    height: getAnswerLabel(configuration, "underBeamHeight"),
    fixing:
      getAnswerLabel(configuration, "fixing") ??
      getAnswerLabel(configuration, "postFixing"),
    hoist:
      configuration.hoistDetail?.title ??
      getAnswerLabel(configuration, "hoistType"),
    hoistType: getAnswerValue(configuration, "hoistType"),
    trolleyMovement: getAnswerValue(
      configuration,
      "hoistTrolleyMovement",
    ),
    options,
  };
}

function LoadingModel() {
  return (
    <Html center>
      <div className="rounded-2xl border border-white/15 bg-slate-950/85 px-4 py-3 text-center text-white shadow-xl backdrop-blur">
        <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-orange-500" />
        <p className="mt-2 text-xs font-black">Chargement de la PFI</p>
      </div>
    </Html>
  );
}

type CameraViewPreset = {
  position: [number, number, number];
  target: [number, number, number];
  fov: number;
  zoom: number;
};

type CameraRigHandle = {
  reset: () => void;
  moveViewVertically: (direction: 1 | -1) => void;
  getViewPreset: () => CameraViewPreset | null;
};

const CameraRig = forwardRef<
  CameraRigHandle,
  {
    dimensions: ConfiguratorModelDimensions;
    cameraPreset?: ConfiguratorCameraPreset;
    assemblyFitKey: string;
  }
>(function CameraRig({ dimensions, cameraPreset, assemblyFitKey }, ref) {
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const dimensionsRef = useRef(dimensions);
  const { camera } = useThree();

  useEffect(() => {
    dimensionsRef.current = dimensions;
  }, [dimensions]);

  const fitWholeAssembly = useCallback(() => {
    const perspectiveCamera = camera as THREE.PerspectiveCamera;
    const currentDimensions = dimensionsRef.current;
    const width = Math.max(currentDimensions.width, 1);
    const height = Math.max(currentDimensions.height, 1);
    const depth = Math.max(currentDimensions.depth, 1);
    const maxDimension = Math.max(width, height, depth);
    const fov = THREE.MathUtils.degToRad(perspectiveCamera.fov || 38);
    const distance = (maxDimension / (2 * Math.tan(fov / 2))) * 1.85;
    const target = new THREE.Vector3(0, height * 0.48, 0);
    const cameraOffset = new THREE.Vector3(
      distance * 0.82,
      distance * 0.46,
      distance * 1.12,
    );

    perspectiveCamera.zoom = 1;
    camera.position.copy(target).add(cameraOffset);
    camera.lookAt(target);
    // Keep a stable clipping range so close zooms never cut the hoist, hook
    // or preset-driven accessories. Dynamic near/far values made small
    // elements disappear depending on the camera angle.
    perspectiveCamera.near = 0.01;
    perspectiveCamera.far = 500;
    perspectiveCamera.updateProjectionMatrix();

    if (controlsRef.current) {
      controlsRef.current.target.copy(target);
      controlsRef.current.minDistance = Math.max(0.4, distance * 0.18);
      controlsRef.current.maxDistance = distance * 4.5;
      controlsRef.current.update();
    }
  }, [camera]);

  const applyAutomaticFit = useCallback(() => {
    const perspectiveCamera = camera as THREE.PerspectiveCamera;
    const currentDimensions = dimensionsRef.current;
    const maxDimension = Math.max(
      currentDimensions.width,
      currentDimensions.height,
      currentDimensions.depth,
      1,
    );

    if (!cameraPreset) {
      fitWholeAssembly();
      return;
    }

    const target = new THREE.Vector3(...cameraPreset.target);
    const position = new THREE.Vector3(...cameraPreset.position);
    const distance = position.distanceTo(target);

    perspectiveCamera.fov = cameraPreset.fov;
    perspectiveCamera.zoom = cameraPreset.zoom;
    perspectiveCamera.position.copy(position);
    perspectiveCamera.lookAt(target);
    // Keep a stable clipping range so close zooms never cut the hoist, hook
    // or preset-driven accessories. Dynamic near/far values made small
    // elements disappear depending on the camera angle.
    perspectiveCamera.near = 0.01;
    perspectiveCamera.far = 500;
    perspectiveCamera.updateProjectionMatrix();

    if (controlsRef.current) {
      controlsRef.current.target.copy(target);
      controlsRef.current.minDistance = Math.max(0.4, distance * 0.18);
      controlsRef.current.maxDistance = Math.max(
        distance * 4.5,
        maxDimension * 4.5,
      );
      controlsRef.current.update();
    }
  }, [camera, cameraPreset, fitWholeAssembly]);

  useEffect(() => {
    // Le cadrage ne doit être rejoué que lorsqu'on charge réellement un autre
    // assemblage. Les options secondaires (interrupteur, ligne, repères, etc.)
    // peuvent modifier la bounding box, mais ne doivent jamais faire reculer
    // la caméra pendant la configuration.
    const frame = window.requestAnimationFrame(() => {
      applyAutomaticFit();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [applyAutomaticFit, assemblyFitKey]);

  useImperativeHandle(
    ref,
    () => ({
      reset: applyAutomaticFit,
      moveViewVertically: (direction) => {
        const controls = controlsRef.current;
        if (!controls) return;

        // Relever/abaisser principalement le point visé pour incliner la vue.
        const step = Math.max(dimensions.height * 0.08, 0.25) * direction;
        controls.target.y += step;
        camera.position.y += step * 0.15;
        camera.lookAt(controls.target);
        controls.update();
      },
      getViewPreset: () => {
        const perspectiveCamera = camera as THREE.PerspectiveCamera;
        const controls = controlsRef.current;
        if (!controls) return null;

        const round = (value: number) => Number(value.toFixed(4));

        return {
          position: camera.position.toArray().map(round) as [
            number,
            number,
            number,
          ],
          target: controls.target.toArray().map(round) as [
            number,
            number,
            number,
          ],
          fov: round(perspectiveCamera.fov),
          zoom: round(perspectiveCamera.zoom),
        };
      },
    }),
    [applyAutomaticFit, camera, dimensions.height],
  );

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      minDistance={0.4}
      maxDistance={60}
      maxPolarAngle={Math.PI / 1.65}
      screenSpacePanning
    />
  );
});

export default function Configurator3DViewer({
  configuration,
  immersive = false,
  presentation = false,
}: {
  configuration: EngineResult;
  immersive?: boolean;
  presentation?: boolean;
}) {
  const state = useMemo(() => build3DState(configuration), [configuration]);
  const preset = getConfiguratorModel(state);
  const [dimensions, setDimensions] = useState(INITIAL_DIMENSIONS);
  const cameraRigRef = useRef<CameraRigHandle | null>(null);
  const [isCalibratorOpen, setIsCalibratorOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [capturedJson, setCapturedJson] = useState("");
  const [isMeshDebuggerOpen, setIsMeshDebuggerOpen] = useState(false);
  const [meshItems, setMeshItems] = useState<ConfiguratorMeshDebugItem[]>([]);
  const [hiddenMeshIds, setHiddenMeshIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [isolatedMeshId, setIsolatedMeshId] = useState<string | null>(null);
  const [meshJsonCopied, setMeshJsonCopied] = useState(false);
  const [inspectedMeshId, setInspectedMeshId] = useState<string | null>(null);
  const [meshComponents, setMeshComponents] = useState<
    ConfiguratorMeshComponentItem[]
  >([]);
  const [hiddenComponentIds, setHiddenComponentIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [isolatedComponentId, setIsolatedComponentId] = useState<string | null>(
    null,
  );
  const [componentJsonCopied, setComponentJsonCopied] = useState(false);
  // Seul un changement de preset complet autorise un nouveau cadrage.
  // Une option électrique ne change pas l'assemblage principal et conserve
  // donc exactement la vue choisie par l'utilisateur.
  const assemblyFitKey = preset?.id ?? "no-model";

  const handleDimensions = useCallback(
    (nextDimensions: ConfiguratorModelDimensions) => {
      setDimensions(nextDimensions);
    },
    [],
  );

  const handleMeshes = useCallback((items: ConfiguratorMeshDebugItem[]) => {
    setMeshItems(items);
  }, []);

  const toggleMesh = useCallback((id: string) => {
    setIsolatedMeshId(null);
    setHiddenMeshIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const showAllMeshes = useCallback(() => {
    setHiddenMeshIds(new Set());
    setIsolatedMeshId(null);
  }, []);

  const inspectMesh = useCallback((id: string) => {
    setInspectedMeshId((current) => (current === id ? null : id));
    setHiddenComponentIds(new Set());
    setIsolatedComponentId(null);
  }, []);

  const toggleComponent = useCallback((id: string) => {
    setIsolatedComponentId(null);
    setHiddenComponentIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const cleanTinyComponents = useCallback(() => {
    setIsolatedComponentId(null);
    setHiddenComponentIds(
      new Set(
        meshComponents.filter((item) => item.tiny).map((item) => item.id),
      ),
    );
  }, [meshComponents]);

  const copyComponentPreset = useCallback(async () => {
    if (!inspectedMeshId) return;
    const payload = {
      version: 1,
      model: preset?.path ?? null,
      meshId: inspectedMeshId,
      removedComponents: meshComponents
        .filter((item) => hiddenComponentIds.has(item.id))
        .map((item) => ({
          id: item.id,
          index: item.index,
          triangles: item.triangles,
          dimensions: {
            width: item.width,
            height: item.height,
            depth: item.depth,
          },
        })),
    };
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      setComponentJsonCopied(true);
      window.setTimeout(() => setComponentJsonCopied(false), 1800);
    } catch {
      setComponentJsonCopied(false);
    }
  }, [hiddenComponentIds, inspectedMeshId, meshComponents, preset?.path]);

  const copyMeshMap = useCallback(async () => {
    const payload = {
      model: preset?.path ?? null,
      meshes: meshItems.map((item) => ({
        id: item.id,
        index: item.index,
        name: item.name,
        nodeName: item.nodeName,
        materialName: item.materialName,
        triangles: item.triangles,
        visible: isolatedMeshId
          ? item.id === isolatedMeshId
          : !hiddenMeshIds.has(item.id),
      })),
    };

    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      setMeshJsonCopied(true);
      window.setTimeout(() => setMeshJsonCopied(false), 1800);
    } catch {
      setMeshJsonCopied(false);
    }
  }, [hiddenMeshIds, isolatedMeshId, meshItems, preset?.path]);

  const copyCameraPreset = useCallback(async () => {
    const view = cameraRigRef.current?.getViewPreset();
    if (!view) return;

    const json = JSON.stringify({ camera: view }, null, 2);
    setCapturedJson(json);

    try {
      await navigator.clipboard.writeText(json);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }, []);

  if (!preset) return null;

  return (
    <div
      className={
        immersive
          ? "h-full min-h-0 overflow-hidden bg-slate-950"
          : presentation
            ? "h-full min-h-0 overflow-hidden bg-slate-950"
            : "h-[376px] overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-inner"
      }
    >
      {!presentation ? (
      <div
        className={
          immersive
            ? "absolute left-5 right-5 top-5 z-30 flex min-h-[66px] items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white shadow-xl backdrop-blur-xl"
            : "flex min-h-[66px] items-center justify-between gap-3 border-b border-white/10 bg-slate-950 px-3 py-2 text-white"
        }
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Box size={14} className="shrink-0 text-orange-400" />
            <p className="truncate text-[9px] font-black uppercase tracking-[0.18em] text-white/60">
              Visualisation 3D
            </p>
          </div>
          <p className="mt-1 truncate text-sm font-black">
            {state.craneType
              ? FAMILY_LABELS[state.craneType]
              : "Sélectionnez une potence"}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setIsMeshDebuggerOpen((value) => !value)}
            className="rounded-full border border-white/15 bg-slate-950/75 p-2 text-white/70 backdrop-blur transition hover:border-cyan-400/60 hover:text-cyan-200"
            aria-label="Ouvrir l’explorateur des composants 3D"
            title="Explorer les composants du modèle"
          >
            <Layers3 size={14} />
          </button>
          <button
            type="button"
            onClick={() => setIsCalibratorOpen((value) => !value)}
            className="rounded-full border border-white/15 bg-slate-950/75 p-2 text-white/70 backdrop-blur transition hover:border-orange-400/60 hover:text-orange-300"
            aria-label="Ouvrir le calibrateur de caméra"
            title="Calibrer le cadrage"
          >
            <Crosshair size={14} />
          </button>
          <button
            type="button"
            onClick={() => cameraRigRef.current?.reset()}
            className="rounded-full border border-white/15 bg-slate-950/75 p-2 text-white/70 backdrop-blur transition hover:border-white/30 hover:text-white"
            aria-label="Recentrer la vue 3D"
            title="Recentrer la vue"
          >
            <RotateCcw size={14} />
          </button>
        </div>
      </div>
      ) : null}

      <div className={immersive || presentation ? "relative h-full" : "relative h-[310px]"}>
        {!presentation ? <Configurator3DOverlay state={state} /> : null}

        {isMeshDebuggerOpen ? (
          <div className="absolute inset-y-3 right-3 z-40 flex w-[290px] flex-col overflow-hidden rounded-2xl border border-cyan-300/20 bg-slate-950/[0.97] text-white shadow-2xl backdrop-blur">
            <div className="border-b border-white/10 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300">
                    Explorateur 3D
                  </p>
                  <p className="mt-1 text-[11px] leading-4 text-white/60">
                    {meshItems.length} meshes détectés. Masquez ou isolez une
                    pièce pour l’identifier.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMeshDebuggerOpen(false)}
                  className="rounded-full p-1 text-white/45 transition hover:bg-white/10 hover:text-white"
                  aria-label="Fermer l’explorateur 3D"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={showAllMeshes}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-2 py-2 text-[10px] font-black transition hover:border-cyan-300/40 hover:bg-cyan-300/10"
                >
                  <Eye size={13} /> Tout afficher
                </button>
                <button
                  type="button"
                  onClick={copyMeshMap}
                  className="flex items-center justify-center gap-1.5 rounded-xl bg-cyan-500 px-2 py-2 text-[10px] font-black text-slate-950 transition hover:bg-cyan-300"
                >
                  {meshJsonCopied ? <Check size={13} /> : <Copy size={13} />}
                  {meshJsonCopied ? "JSON copié" : "Copier JSON"}
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              {inspectedMeshId ? (
                <div className="mb-2 rounded-2xl border border-violet-300/25 bg-violet-400/[0.08] p-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-[0.16em] text-violet-300">
                        Mesh Inspector
                      </p>
                      <p className="mt-1 text-[11px] font-black">
                        {inspectedMeshId}
                      </p>
                      <p className="mt-0.5 text-[9px] text-white/45">
                        {meshComponents.length} composantes connectées détectées
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => inspectMesh(inspectedMeshId)}
                      className="rounded-lg p-1 text-white/45 hover:bg-white/10 hover:text-white"
                    >
                      <X size={13} />
                    </button>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={cleanTinyComponents}
                      className="flex items-center justify-center gap-1 rounded-lg bg-violet-500 px-2 py-1.5 text-[9px] font-black text-white hover:bg-violet-400"
                    >
                      <Sparkles size={12} /> Nettoyer petits îlots
                    </button>
                    <button
                      type="button"
                      onClick={copyComponentPreset}
                      className="flex items-center justify-center gap-1 rounded-lg border border-white/15 bg-white/5 px-2 py-1.5 text-[9px] font-black hover:border-violet-300/40"
                    >
                      <Copy size={12} />{" "}
                      {componentJsonCopied ? "Preset copié" : "Copier preset"}
                    </button>
                  </div>
                  <div className="mt-2 max-h-56 space-y-1 overflow-y-auto pr-1">
                    {meshComponents.map((component) => {
                      const hidden = hiddenComponentIds.has(component.id);
                      const isolated = isolatedComponentId === component.id;
                      return (
                        <div
                          key={component.id}
                          className={`rounded-lg border p-1.5 ${component.tiny ? "border-rose-400/30 bg-rose-400/[0.08]" : "border-white/10 bg-black/15"}`}
                        >
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => toggleComponent(component.id)}
                              className={`rounded-md p-1 ${hidden ? "bg-rose-400/10 text-rose-300" : "bg-cyan-400/10 text-cyan-200"}`}
                              title={
                                hidden ? "Restaurer" : "Supprimer de l’aperçu"
                              }
                            >
                              {hidden ? (
                                <Trash2 size={11} />
                              ) : (
                                <Eye size={11} />
                              )}
                            </button>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[9px] font-black">
                                Composante {component.index}
                                {component.tiny ? " · micro-îlot" : ""}
                              </p>
                              <p className="text-[8px] text-white/40">
                                {component.triangles.toLocaleString("fr-FR")}{" "}
                                triangles · {component.width.toFixed(3)} ×{" "}
                                {component.height.toFixed(3)} ×{" "}
                                {component.depth.toFixed(3)}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                setIsolatedComponentId((current) =>
                                  current === component.id
                                    ? null
                                    : component.id,
                                )
                              }
                              className={`rounded-md p-1 ${isolated ? "bg-orange-400 text-slate-950" : "bg-white/5 text-white/50"}`}
                              title="Isoler la composante"
                            >
                              <Scan size={11} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}
              <div className="space-y-1.5">
                {meshItems.map((item) => {
                  const isHidden = hiddenMeshIds.has(item.id);
                  const isIsolated = isolatedMeshId === item.id;
                  return (
                    <div
                      key={item.id}
                      className={`rounded-xl border p-2 transition ${
                        isIsolated
                          ? "border-orange-400/70 bg-orange-400/10"
                          : "border-white/10 bg-white/[0.035] hover:border-white/20"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => toggleMesh(item.id)}
                          className={`rounded-lg p-1.5 transition ${
                            isHidden
                              ? "bg-white/5 text-white/35"
                              : "bg-cyan-400/10 text-cyan-200"
                          }`}
                          title={
                            isHidden ? "Afficher ce mesh" : "Masquer ce mesh"
                          }
                        >
                          {isHidden ? <EyeOff size={13} /> : <Eye size={13} />}
                        </button>

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[11px] font-black">
                            {item.id} · {item.name}
                          </p>
                          <p className="truncate text-[9px] text-white/45">
                            Parent : {item.nodeName} ·{" "}
                            {item.triangles.toLocaleString("fr-FR")} triangles
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => inspectMesh(item.id)}
                          className={`rounded-lg p-1.5 transition ${inspectedMeshId === item.id ? "bg-violet-500 text-white" : "bg-white/5 text-white/55 hover:bg-violet-400/15 hover:text-violet-200"}`}
                          title="Analyser les composantes de ce mesh"
                        >
                          <Boxes size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setIsolatedMeshId((current) =>
                              current === item.id ? null : item.id,
                            )
                          }
                          className={`rounded-lg p-1.5 transition ${
                            isIsolated
                              ? "bg-orange-400 text-slate-950"
                              : "bg-white/5 text-white/55 hover:bg-orange-400/15 hover:text-orange-300"
                          }`}
                          title={
                            isIsolated
                              ? "Quitter l’isolation"
                              : "Isoler ce mesh"
                          }
                        >
                          <Scan size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : null}

        {isCalibratorOpen ? (
          <div className="absolute right-3 top-3 z-30 w-[260px] rounded-2xl border border-white/15 bg-slate-950/95 p-3 text-white shadow-2xl backdrop-blur">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-orange-400">
                  Calibrateur caméra
                </p>
                <p className="mt-1 text-[11px] leading-4 text-white/65">
                  Tournez avec le clic gauche, zoomez à la molette et déplacez
                  la cible avec le clic droit.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCalibratorOpen(false)}
                className="rounded-full p-1 text-white/45 transition hover:bg-white/10 hover:text-white"
                aria-label="Fermer le calibrateur"
              >
                <X size={14} />
              </button>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => cameraRigRef.current?.moveViewVertically(1)}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-2 py-2 text-[11px] font-black text-white/80 transition hover:border-cyan-400/50 hover:bg-cyan-400/10 hover:text-cyan-100"
                title="Relever la vue sans changer le zoom"
              >
                <ArrowUp size={13} />
                Relever
              </button>
              <button
                type="button"
                onClick={() => cameraRigRef.current?.moveViewVertically(-1)}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-2 py-2 text-[11px] font-black text-white/80 transition hover:border-cyan-400/50 hover:bg-cyan-400/10 hover:text-cyan-100"
                title="Descendre la vue sans changer le zoom"
              >
                <ArrowDown size={13} />
                Descendre
              </button>
            </div>

            <button
              type="button"
              onClick={copyCameraPreset}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-3 py-2 text-xs font-black text-white transition hover:bg-orange-400"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? "JSON copié" : "Copier le JSON"}
            </button>

            {capturedJson ? (
              <pre className="mt-2 max-h-28 overflow-auto rounded-xl border border-white/10 bg-black/30 p-2 text-[9px] leading-4 text-cyan-100/75">
                {capturedJson}
              </pre>
            ) : null}
          </div>
        ) : null}

        <Canvas
          shadows
          camera={{ position: [5.6, 3.8, 6.8], fov: 38, near: 0.01, far: 500 }}
        >
          <color attach="background" args={["#0f172a"]} />
          <ambientLight intensity={1.15} />
          <hemisphereLight args={["#e0f2fe", "#172033", 1.1]} />
          <directionalLight position={[7, 9, 6]} intensity={3.1} castShadow />
          <directionalLight position={[-4, 3, -4]} intensity={0.8} />
          <Suspense fallback={<LoadingModel />}>
            <Configurator3DScene
              preset={preset}
              onDimensions={handleDimensions}
              onMeshes={handleMeshes}
              hiddenMeshIds={hiddenMeshIds}
              isolatedMeshId={isolatedMeshId}
              inspectedMeshId={inspectedMeshId}
              hiddenComponentIds={hiddenComponentIds}
              isolatedComponentId={isolatedComponentId}
              onComponents={setMeshComponents}
              configuration={configuration}
            />
          </Suspense>
          <CameraRig
            ref={cameraRigRef}
            dimensions={dimensions}
            cameraPreset={preset.camera}
            assemblyFitKey={assemblyFitKey}
          />
        </Canvas>
      </div>
    </div>
  );
}
