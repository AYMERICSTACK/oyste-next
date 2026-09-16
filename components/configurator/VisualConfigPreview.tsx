"use client";

import { Suspense, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import {
  ContactShadows,
  OrbitControls,
  Environment,
  AccumulativeShadows,
  RandomizedLight,
  Grid,
  Html,
} from "@react-three/drei";
import {
  Box,
  Cuboid,
  MousePointer2,
  RotateCcw,
  Eye,
  Ruler,
  Weight,
  Maximize2,
  SquareStack,
  BoxSelect,
  type LucideIcon,
} from "lucide-react";
import type { EngineResult } from "@/lib/configurator/types";
import Configurator3DViewer from "./Configurator3DViewer";

type VisualConfigPreviewProps = {
  configuration: EngineResult;
  variant?: "compact" | "large";
};

type PreviewState = ReturnType<typeof getPreviewState>;
type TechnicalView = "iso" | "front" | "top" | "side";

const FAMILY_LABELS: Record<string, string> = {
  PFI: "Potence sur fût inversée",
  PFT: "Potence sur fût triangulée",
  PMI: "Potence murale inversée",
  PMT: "Potence murale triangulée",
  PMA: "Potence murale articulée",
  PMAM: "Potence murale articulée motorisée",
};

function getAnswerLabel(configuration: EngineResult, questionId: string) {
  const question = configuration.questions.find(
    (item) => item.id === questionId,
  );
  const answer = configuration.answers[questionId];

  if (Array.isArray(answer)) {
    const labels = question?.choices
      .filter((choice) => answer.includes(choice.id))
      .map((choice) => choice.label);

    return labels?.length ? labels.join(", ") : undefined;
  }

  return question?.choices.find((choice) => choice.id === answer)?.label;
}

function getAnswerValue(configuration: EngineResult, questionId: string) {
  const answer = configuration.answers[questionId];
  return typeof answer === "string" ? answer : undefined;
}

function parseMeters(value?: string, fallback = 3) {
  if (!value) return fallback;
  const match = value.replace(",", ".").match(/(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : fallback;
}

function parseCapacityKg(value?: string, fallback = 250) {
  if (!value) return fallback;
  const match = value.match(/\d+/);
  return match ? Number(match[0]) : fallback;
}

function formatMillimeters(value: number) {
  return `${Math.round(value * 1000).toLocaleString("fr-FR")} mm`;
}

function getRotationLabel(family: string) {
  if (["PMA", "PMAM"].includes(family)) return "Articulée";
  if (["PFI", "PFT"].includes(family)) return "270° / 360°";
  return "180°";
}

function getFamilyState(configuration: EngineResult) {
  const selectedFamily = getAnswerValue(configuration, "potenceType");
  const solutionCode = configuration.erpInstallation.match?.ouvrage.code;
  const detectedFamily = solutionCode?.match(
    /^(PFI|PFT|PMI|PMT|PMA|PMAM)/,
  )?.[1];

  return {
    family: selectedFamily ?? detectedFamily ?? "PFI",
    hasFamily: Boolean(selectedFamily ?? detectedFamily),
  };
}

function getPreviewState(configuration: EngineResult) {
  const { family, hasFamily } = getFamilyState(configuration);
  const reachValue = getAnswerValue(configuration, "reach");
  const underBeamHeightValue = getAnswerValue(configuration, "underBeamHeight");
  const liftingHeightValue = getAnswerValue(configuration, "liftingHeight");
  const capacityValue = getAnswerValue(configuration, "capacity");
  const reach = parseMeters(reachValue, 3);
  const underBeamHeight = parseMeters(underBeamHeightValue, 3);
  const liftingHeight = parseMeters(liftingHeightValue, 3);
  const capacityKg = parseCapacityKg(capacityValue);
  const hasHoist = getAnswerValue(configuration, "hoist") === "yes";
  const hoistType = getAnswerValue(configuration, "hoistType");
  const command = getAnswerLabel(configuration, "hoistCommand");
  const trolley = getAnswerLabel(configuration, "hoistTrolleyMovement");
  const environment = getAnswerLabel(configuration, "environment");

  const isWallMounted = ["PMI", "PMT", "PMA", "PMAM"].includes(family);
  const isTriangulated = ["PFT", "PMT"].includes(family);
  const isArticulated = ["PMA", "PMAM"].includes(family);
  const isMotorizedArticulated = family === "PMAM";
  const beamLength = Math.min(6.6, Math.max(2.4, reach));
  const columnHeight = Math.min(5.5, Math.max(2.6, underBeamHeight));
  const hoistPosition = beamLength * 0.82;
  const loadScale = Math.min(1.35, Math.max(0.78, capacityKg / 850));

  return {
    family,
    hasFamily,
    familyLabel: hasFamily
      ? (FAMILY_LABELS[family] ?? "Potence configurée")
      : "Potence à configurer",
    rotationLabel: hasFamily ? getRotationLabel(family) : undefined,
    capacity: getAnswerLabel(configuration, "capacity"),
    hasCapacity: Boolean(capacityValue),
    reach,
    hasReach: Boolean(reachValue),
    reachLabel: getAnswerLabel(configuration, "reach"),
    underBeamHeight,
    hasUnderBeamHeight: Boolean(underBeamHeightValue),
    underBeamHeightLabel: getAnswerLabel(configuration, "underBeamHeight"),
    liftingHeight,
    hasLiftingHeight: Boolean(liftingHeightValue),
    liftingHeightLabel: getAnswerLabel(configuration, "liftingHeight"),
    hasHoist,
    hoistType,
    command,
    trolley,
    environment,
    isWallMounted,
    isTriangulated,
    isArticulated,
    isMotorizedArticulated,
    beamLength,
    columnHeight,
    hoistPosition,
    loadScale,
  };
}

function MetricPill({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/70 bg-white/85 px-3 py-2 shadow-sm shadow-slate-200/60 backdrop-blur">
      <div className="flex items-center gap-2">
        <Icon className="text-[#007f8f]" size={15} />
        <p className="text-[10px] font-black uppercase tracking-[0.13em] text-slate-500">
          {label}
        </p>
      </div>
      <p className="mt-1 text-sm font-black leading-5 text-slate-950">
        {value ?? "À choisir"}
      </p>
    </div>
  );
}

function BoxMesh({
  position,
  scale,
  color,
  roughness = 0.58,
  metalness = 0.34,
  emissive,
  emissiveIntensity = 0,
}: {
  position: [number, number, number];
  scale: [number, number, number];
  color: string;
  roughness?: number;
  metalness?: number;
  emissive?: string;
  emissiveIntensity?: number;
}) {
  return (
    <mesh position={position} castShadow receiveShadow>
      <boxGeometry args={scale} />
      <meshStandardMaterial
        color={color}
        metalness={metalness}
        roughness={roughness}
        emissive={emissive}
        emissiveIntensity={emissiveIntensity}
      />
    </mesh>
  );
}

function CylinderMesh({
  position,
  scale,
  color,
  roughness = 0.48,
  metalness = 0.38,
}: {
  position: [number, number, number];
  scale: [number, number, number];
  color: string;
  roughness?: number;
  metalness?: number;
}) {
  return (
    <mesh position={position} scale={scale} castShadow receiveShadow>
      <cylinderGeometry args={[0.5, 0.5, 1, 48]} />
      <meshStandardMaterial color={color} metalness={metalness} roughness={roughness} />
    </mesh>
  );
}

function CadBeam({
  position,
  length,
  color = "#0f172a",
  accent = "#007f8f",
  depth = 0.38,
  flangeWidth = 0.5,
}: {
  position: [number, number, number];
  length: number;
  color?: string;
  accent?: string;
  depth?: number;
  flangeWidth?: number;
}) {
  const flangeThickness = depth * 0.18;
  const webThickness = flangeWidth * 0.18;

  return (
    <group position={position}>
      <BoxMesh
        position={[0, depth / 2 - flangeThickness / 2, 0]}
        scale={[length, flangeThickness, flangeWidth]}
        color={color}
        roughness={0.46}
      />
      <BoxMesh
        position={[0, -depth / 2 + flangeThickness / 2, 0]}
        scale={[length, flangeThickness, flangeWidth]}
        color={color}
        roughness={0.46}
      />
      <BoxMesh
        position={[0, 0, 0]}
        scale={[length, depth - flangeThickness * 2, webThickness]}
        color={color}
        roughness={0.52}
      />
      <BoxMesh
        position={[0, depth / 2 + 0.035, 0]}
        scale={[length * 0.98, 0.035, flangeWidth * 0.82]}
        color={accent}
        roughness={0.32}
        metalness={0.48}
      />
      <BoxMesh
        position={[0, -depth / 2 - 0.03, flangeWidth * 0.31]}
        scale={[length * 0.96, 0.018, 0.022]}
        color="#64748b"
        roughness={0.28}
        metalness={0.72}
      />
      <BoxMesh
        position={[0, -depth / 2 - 0.03, -flangeWidth * 0.31]}
        scale={[length * 0.96, 0.018, 0.022]}
        color="#64748b"
        roughness={0.28}
        metalness={0.72}
      />
    </group>
  );
}

function Bolt({
  position,
  radius = 0.055,
  height = 0.075,
  color = "#94a3b8",
}: {
  position: [number, number, number];
  radius?: number;
  height?: number;
  color?: string;
}) {
  return (
    <mesh position={position} castShadow receiveShadow>
      <cylinderGeometry args={[radius, radius, height, 6]} />
      <meshStandardMaterial color={color} metalness={0.62} roughness={0.32} />
    </mesh>
  );
}

function BasePlateCad({
  position = [0, 0, 0],
}: {
  position?: [number, number, number];
}) {
  const bolts: [number, number, number][] = [
    [-0.38, 0.15, -0.38],
    [0.38, 0.15, -0.38],
    [-0.38, 0.15, 0.38],
    [0.38, 0.15, 0.38],
  ];

  return (
    <group position={position}>
      <BoxMesh
        position={[0, 0.06, 0]}
        scale={[1.22, 0.12, 1.22]}
        color="#111827"
        roughness={0.44}
      />
      <BoxMesh
        position={[0, 0.135, 0]}
        scale={[0.76, 0.035, 0.76]}
        color="#334155"
        roughness={0.5}
      />
      {bolts.map((bolt) => (
        <Bolt key={bolt.join("-")} position={bolt} />
      ))}
    </group>
  );
}

function ColumnCad({ height }: { height: number }) {
  return (
    <group>
      <CylinderMesh
        position={[0, height / 2, 0]}
        scale={[0.23, height, 0.23]}
        color="#0f172a"
      />
      <CylinderMesh
        position={[0, height - 0.08, 0]}
        scale={[0.34, 0.12, 0.34]}
        color="#111827"
      />
      <CylinderMesh
        position={[0, height + 0.08, 0]}
        scale={[0.42, 0.08, 0.42]}
        color="#007f8f"
      />
      <BasePlateCad />
    </group>
  );
}

function WallBracketCad({ height }: { height: number }) {
  const anchors: [number, number, number][] = [
    [0.03, height - 0.55, 0.29],
    [0.03, height - 0.55, -0.29],
    [0.03, height - 1.05, 0.29],
    [0.03, height - 1.05, -0.29],
  ];

  return (
    <group>
      <BoxMesh
        position={[-0.24, height / 2, -0.28]}
        scale={[0.34, height + 0.72, 0.38]}
        color="#334155"
        roughness={0.7}
      />
      <BoxMesh
        position={[0, height - 0.22, 0]}
        scale={[0.42, 0.88, 0.72]}
        color="#0f172a"
        roughness={0.46}
      />
      <BoxMesh
        position={[0.2, height - 0.55, 0.32]}
        scale={[0.55, 0.08, 0.08]}
        color="#007f8f"
        roughness={0.42}
      />
      <BoxMesh
        position={[0.2, height - 0.55, -0.32]}
        scale={[0.55, 0.08, 0.08]}
        color="#007f8f"
        roughness={0.42}
      />
      {anchors.map((anchor) => (
        <Bolt key={anchor.join("-")} position={anchor} radius={0.045} />
      ))}
    </group>
  );
}

function TrolleyCad({ x }: { x: number }) {
  return (
    <group position={[x, 0.2, 0]}>
      <BoxMesh
        position={[0, 0.18, 0]}
        scale={[0.58, 0.16, 0.68]}
        color="#111827"
        roughness={0.42}
      />
      {[-0.22, 0.22].flatMap((wheelX) =>
        [-0.31, 0.31].map((wheelZ) => (
          <mesh
            key={`${wheelX}-${wheelZ}`}
            position={[wheelX, 0.05, wheelZ]}
            rotation={[Math.PI / 2, 0, 0]}
            castShadow
            receiveShadow
          >
            <cylinderGeometry args={[0.11, 0.11, 0.07, 28]} />
            <meshStandardMaterial
              color="#64748b"
              metalness={0.55}
              roughness={0.28}
            />
          </mesh>
        )),
      )}
      <BoxMesh
        position={[0, -0.16, 0]}
        scale={[0.36, 0.22, 0.38]}
        color="#007f8f"
        roughness={0.42}
      />
    </group>
  );
}

function HookCad({
  position,
  scale = 1,
}: {
  position: [number, number, number];
  scale?: number;
}) {
  return (
    <group position={position} scale={[scale, scale, scale]}>
      <mesh rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
        <torusGeometry args={[0.14, 0.026, 12, 28, Math.PI * 1.45]} />
        <meshStandardMaterial
          color="#0f172a"
          metalness={0.5}
          roughness={0.35}
        />
      </mesh>
      <BoxMesh
        position={[0, 0.12, 0]}
        scale={[0.06, 0.16, 0.06]}
        color="#0f172a"
      />
    </group>
  );
}

function EndStopCad({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <BoxMesh
        position={[0, 0, 0]}
        scale={[0.08, 0.52, 0.62]}
        color="#ea580c"
        roughness={0.4}
      />
      <Bolt position={[0, 0.18, 0.18]} radius={0.035} height={0.05} />
      <Bolt position={[0, -0.18, -0.18]} radius={0.035} height={0.05} />
    </group>
  );
}

function DiagonalBrace({
  start,
  end,
  color = "#0f172a",
}: {
  start: [number, number, number];
  end: [number, number, number];
  color?: string;
}) {
  const { position, length, angle } = useMemo(() => {
    const dx = end[0] - start[0];
    const dy = end[1] - start[1];
    const dz = end[2] - start[2];

    return {
      position: [
        (start[0] + end[0]) / 2,
        (start[1] + end[1]) / 2,
        (start[2] + end[2]) / 2,
      ] as [number, number, number],
      length: Math.sqrt(dx * dx + dy * dy + dz * dz),
      angle: Math.atan2(dy, dx),
    };
  }, [end, start]);

  return (
    <mesh position={position} rotation={[0, 0, angle]} castShadow receiveShadow>
      <boxGeometry args={[length, 0.08, 0.08]} />
      <meshStandardMaterial color={color} metalness={0.32} roughness={0.5} />
    </mesh>
  );
}

function HoistModel({ state, x }: { state: PreviewState; x: number }) {
  if (!state.hasHoist) {
    return (
      <group position={[x, state.columnHeight - 0.68, 0]}>
        <BoxMesh
          position={[0, 0, 0]}
          scale={[0.52, 0.42, 0.48]}
          color="#e2e8f0"
          roughness={0.82}
        />
        <BoxMesh
          position={[0, -0.66, 0]}
          scale={[0.04, 0.86, 0.04]}
          color="#94a3b8"
          roughness={0.7}
        />
      </group>
    );
  }

  const loadHeight = 0.52 * state.loadScale;

  return (
    <group position={[x, state.columnHeight - 0.76, 0]}>
      <TrolleyCad x={0} />
      <BoxMesh
        position={[0, 0.22, 0]}
        scale={[0.72, 0.22, 0.62]}
        color="#111827"
      />
      <BoxMesh
        position={[0, -0.13, 0]}
        scale={[0.54, 0.48, 0.54]}
        color="#ea580c"
        roughness={0.42}
      />
      <BoxMesh
        position={[0, -0.76, 0]}
        scale={[0.035, 0.82, 0.035]}
        color="#334155"
      />
      <BoxMesh
        position={[0, -1.26, 0]}
        scale={[0.32 * state.loadScale, loadHeight, 0.32 * state.loadScale]}
        color="#0f172a"
      />
      <HookCad position={[0, -1.72, 0]} scale={state.loadScale} />
      {state.command && (
        <BoxMesh
          position={[0.52, -0.78, 0.26]}
          scale={[0.06, 1.15, 0.06]}
          color="#475569"
        />
      )}
    </group>
  );
}

function ArticulatedBeam({ state }: { state: PreviewState }) {
  const firstLength = state.beamLength * 0.52;
  const secondLength = state.beamLength * 0.48;

  return (
    <group position={[0, state.columnHeight, 0]}>
      <CadBeam position={[firstLength / 2, 0, 0]} length={firstLength} />
      <CylinderMesh
        position={[firstLength, 0, 0]}
        scale={[0.22, 0.24, 0.22]}
        color="#007f8f"
      />
      <group position={[firstLength, 0, 0]} rotation={[0, -0.34, 0]}>
        <CadBeam
          position={[secondLength / 2, 0, 0]}
          length={secondLength}
          color="#007f8f"
          accent="#0f172a"
          depth={0.32}
          flangeWidth={0.44}
        />
        {state.isMotorizedArticulated && (
          <BoxMesh
            position={[0.34, 0.34, 0]}
            scale={[0.42, 0.34, 0.46]}
            color="#ea580c"
            roughness={0.42}
          />
        )}
        <HoistModel state={state} x={secondLength * 0.78} />
      </group>
    </group>
  );
}

function PotenceModel({ state }: { state: PreviewState }) {
  const beamStartX = state.isWallMounted ? 0.18 : 0;
  const hoistX = beamStartX + state.hoistPosition;

  return (
    <group position={[-state.beamLength / 2.45, -state.columnHeight / 2.15, 0]}>
      <BoxMesh
        position={[state.beamLength / 2, -0.12, 0]}
        scale={[state.beamLength + 1.15, 0.06, 2.8]}
        color="#e2e8f0"
        roughness={0.86}
      />

      {state.isWallMounted ? (
        <WallBracketCad height={state.columnHeight} />
      ) : (
        <ColumnCad height={state.columnHeight} />
      )}

      {state.isArticulated ? (
        <ArticulatedBeam state={state} />
      ) : (
        <group>
          <CadBeam
            position={[
              beamStartX + state.beamLength / 2,
              state.columnHeight,
              0,
            ]}
            length={state.beamLength}
          />
          <EndStopCad
            position={[
              beamStartX + state.beamLength + 0.04,
              state.columnHeight,
              0,
            ]}
          />

          {state.isTriangulated && (
            <>
              <DiagonalBrace
                start={[0.18, state.columnHeight - 0.98, 0.16]}
                end={[state.beamLength * 0.82, state.columnHeight - 0.02, 0.16]}
              />
              <DiagonalBrace
                start={[0.18, state.columnHeight - 0.98, -0.16]}
                end={[
                  state.beamLength * 0.82,
                  state.columnHeight - 0.02,
                  -0.16,
                ]}
                color="#007f8f"
              />
            </>
          )}

          <HoistModel state={state} x={hoistX} />
        </group>
      )}
    </group>
  );
}

function DimensionLine({
  start,
  end,
  label,
  labelPosition,
  vertical = false,
}: {
  start: [number, number, number];
  end: [number, number, number];
  label: string;
  labelPosition: [number, number, number];
  vertical?: boolean;
}) {
  const { position, length, rotation } = useMemo(() => {
    const dx = end[0] - start[0];
    const dy = end[1] - start[1];
    const dz = end[2] - start[2];
    const horizontalLength = Math.sqrt(dx * dx + dz * dz);

    return {
      position: [
        (start[0] + end[0]) / 2,
        (start[1] + end[1]) / 2,
        (start[2] + end[2]) / 2,
      ] as [number, number, number],
      length: Math.sqrt(dx * dx + dy * dy + dz * dz),
      rotation: [
        0,
        dz ? Math.atan2(dz, dx) : 0,
        horizontalLength ? Math.atan2(dy, horizontalLength) : Math.PI / 2,
      ] as [number, number, number],
    };
  }, [end, start]);

  const capA: [number, number, number] = vertical ? [0.18, 0, 0] : [0, 0.18, 0];
  const capB: [number, number, number] = vertical
    ? [-0.18, 0, 0]
    : [0, -0.18, 0];

  return (
    <group>
      <mesh
        position={position}
        rotation={rotation}
        castShadow={false}
        receiveShadow={false}
      >
        <boxGeometry args={[length, 0.018, 0.018]} />
        <meshStandardMaterial
          color="#007f8f"
          metalness={0.12}
          roughness={0.38}
        />
      </mesh>
      {[start, end].map((point) => (
        <group key={point.join("-")} position={point}>
          <mesh position={capA} castShadow={false} receiveShadow={false}>
            <boxGeometry
              args={vertical ? [0.36, 0.018, 0.018] : [0.018, 0.36, 0.018]}
            />
            <meshStandardMaterial color="#007f8f" roughness={0.38} />
          </mesh>
          <mesh position={capB} castShadow={false} receiveShadow={false}>
            <boxGeometry
              args={vertical ? [0.36, 0.018, 0.018] : [0.018, 0.36, 0.018]}
            />
            <meshStandardMaterial color="#007f8f" roughness={0.38} />
          </mesh>
        </group>
      ))}
      <Html
        position={labelPosition}
        center
        distanceFactor={8}
        transform={false}
        occlude={false}
      >
        <span className="whitespace-nowrap rounded-md border border-[#007f8f]/20 bg-white/95 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-[#005466] shadow-sm backdrop-blur">
          {label}
        </span>
      </Html>
    </group>
  );
}

function AxisMarker({
  label,
  position,
  color,
}: {
  label: string;
  position: [number, number, number];
  color: string;
}) {
  return (
    <group position={position}>
      <mesh castShadow>
        <sphereGeometry args={[0.055, 18, 18]} />
        <meshStandardMaterial color={color} metalness={0.2} roughness={0.45} />
      </mesh>
      <Html
        position={[0, 0.18, 0]}
        center
        distanceFactor={8}
        transform={false}
        occlude={false}
      >
        <span
          className="rounded-full border border-white/80 bg-white/90 px-1.5 py-0.5 text-[10px] font-black shadow-sm"
          style={{ color }}
        >
          {label}
        </span>
      </Html>
    </group>
  );
}

function WorkshopShell({
  floorY,
  wallX,
}: {
  floorY: number;
  wallX: number;
}) {
  const floorTiles = [-4, -2, 0, 2, 4];
  const wallPanels = [-1.95, -1.25, -0.55, 0.15, 0.85, 1.55];

  return (
    <group>
      <mesh position={[0.8, floorY - 0.04, 0]} receiveShadow>
        <boxGeometry args={[10.8, 0.08, 7.4]} />
        <meshStandardMaterial color="#d7dce3" roughness={0.96} metalness={0.01} />
      </mesh>

      {floorTiles.map((x) => (
        <BoxMesh
          key={`floor-x-${x}`}
          position={[x, floorY + 0.006, 0]}
          scale={[0.014, 0.01, 7.25]}
          color="#b7c2cf"
          roughness={0.94}
          metalness={0.02}
        />
      ))}
      {[-3, -1.5, 0, 1.5, 3].map((z) => (
        <BoxMesh
          key={`floor-z-${z}`}
          position={[0.8, floorY + 0.008, z]}
          scale={[10.4, 0.01, 0.014]}
          color="#b7c2cf"
          roughness={0.94}
          metalness={0.02}
        />
      ))}

      <mesh position={[wallX, floorY + 1.78, -2.08]} receiveShadow>
        <boxGeometry args={[0.08, 4.05, 4.6]} />
        <meshStandardMaterial color="#ccd3dc" roughness={0.9} metalness={0.02} />
      </mesh>
      {wallPanels.map((z) => (
        <BoxMesh
          key={`wall-panel-${z}`}
          position={[wallX + 0.052, floorY + 1.78, z]}
          scale={[0.025, 3.82, 0.018]}
          color="#aeb8c5"
          roughness={0.88}
          metalness={0.04}
        />
      ))}
      {[0.55, 1.45, 2.35, 3.25].map((y) => (
        <BoxMesh
          key={`wall-y-${y}`}
          position={[wallX + 0.055, floorY + y, -2.08]}
          scale={[0.026, 0.018, 4.48]}
          color="#aeb8c5"
          roughness={0.88}
          metalness={0.04}
        />
      ))}

      <BoxMesh
        position={[1.25, floorY + 3.95, -0.6]}
        scale={[7.2, 0.055, 0.42]}
        color="#f8fafc"
        roughness={0.22}
        metalness={0.05}
        emissive="#e0f7ff"
        emissiveIntensity={0.45}
      />
      <BoxMesh
        position={[1.25, floorY + 3.95, 1.55]}
        scale={[7.2, 0.055, 0.42]}
        color="#f8fafc"
        roughness={0.22}
        metalness={0.05}
        emissive="#e0f7ff"
        emissiveIntensity={0.34}
      />
    </group>
  );
}

function IndustrialScene({
  state,
  showGuides,
}: {
  state: PreviewState;
  showGuides: boolean;
}) {
  const modelOriginX = -state.beamLength / 2.45;
  const modelOriginY = -state.columnHeight / 2.15;
  const beamStartX = modelOriginX + (state.isWallMounted ? 0.18 : 0);
  const beamEndX = beamStartX + state.beamLength;
  const beamY = modelOriginY + state.columnHeight;
  const floorY = modelOriginY - 0.12;
  const heightX = modelOriginX - 0.72;
  const wallX = modelOriginX - 0.58;

  return (
    <group>
      <WorkshopShell floorY={floorY} wallX={wallX} />
      <Grid
        position={[0.8, floorY + 0.014, 0]}
        args={[10, 7]}
        cellSize={0.5}
        sectionSize={2}
        cellThickness={0.22}
        sectionThickness={0.58}
        cellColor="#cbd5e1"
        sectionColor="#93c5fd"
        fadeDistance={11}
        fadeStrength={1}
        infiniteGrid={false}
      />

      {showGuides && (
        <>
          <DimensionLine
            start={[beamStartX, beamY + 0.58, 0.62]}
            end={[beamEndX, beamY + 0.58, 0.62]}
            label={
              state.hasReach
                ? `Portée ${formatMillimeters(state.reach)}`
                : "Portée à choisir"
            }
            labelPosition={[(beamStartX + beamEndX) / 2, beamY + 0.82, 0.72]}
          />
          <DimensionLine
            start={[heightX, floorY + 0.08, 0.8]}
            end={[heightX, beamY, 0.8]}
            label={
              state.hasUnderBeamHeight
                ? `HSF ${formatMillimeters(state.underBeamHeight)}`
                : "HSF à choisir"
            }
            vertical
            labelPosition={[heightX - 0.18, (floorY + beamY) / 2, 0.92]}
          />

          <AxisMarker
            label="X"
            position={[3.6, floorY + 0.1, 0]}
            color="#ea580c"
          />
          <AxisMarker
            label="Y"
            position={[0, floorY + 1.6, 0]}
            color="#007f8f"
          />
          <AxisMarker
            label="Z"
            position={[0, floorY + 0.1, 1.65]}
            color="#334155"
          />
        </>
      )}
    </group>
  );
}

function ThreeScene({
  state,
  isLarge,
  showGuides,
  view,
}: {
  state: PreviewState;
  isLarge: boolean;
  showGuides: boolean;
  view: TechnicalView;
}) {
  const cameraPresets: Record<TechnicalView, [number, number, number]> = {
    iso: isLarge ? [7.15, 4.95, 7.55] : [6.45, 4.35, 7.1],
    front: [1.25, 1.55, 9.6],
    side: [8.7, 1.7, 0.25],
    top: [1.2, 9.5, 0.12],
  };
  const cameraTargets: Record<TechnicalView, [number, number, number]> = {
    iso: [1.25, 0.85, 0],
    front: [1.2, 0.78, 0],
    side: [1.25, 0.78, 0],
    top: [1.2, 0.65, 0],
  };
  const cameraPosition = cameraPresets[view];
  const cameraTarget = cameraTargets[view];

  return (
    <Canvas
      shadows
      dpr={[1, 1.8]}
      camera={{ position: cameraPosition, fov: 40 }}
      gl={{ antialias: true, alpha: true }}
    >
      <color attach="background" args={["#f1f5f9"]} />
      <fog attach="fog" args={["#f1f5f9", 10, 20]} />
      <ambientLight intensity={0.62} />
      <hemisphereLight args={["#e0f2fe", "#cbd5e1", 0.65]} />
      <directionalLight
        position={[5.5, 8.5, 6.25]}
        intensity={1.35}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.00012}
      />
      <rectAreaLight
        position={[1.2, 5.2, -0.55]}
        rotation={[-Math.PI / 2.6, 0, 0]}
        width={6.6}
        height={1.4}
        intensity={2.3}
        color="#e0f7ff"
      />
      <pointLight position={[-4.5, 3.6, -4.5]} intensity={0.35} color="#fb923c" />
      <pointLight position={[5.5, 2.8, 3.8]} intensity={0.32} color="#22d3ee" />
      <Suspense fallback={null}>
        <IndustrialScene state={state} showGuides={showGuides} />
        <PotenceModel state={state} />
        <ContactShadows
          position={[0, -2.02, 0]}
          opacity={0.34}
          scale={10.5}
          blur={3.2}
          far={3.4}
          resolution={1024}
        />
        <AccumulativeShadows
          temporal
          frames={50}
          alphaTest={0.85}
          scale={12}
          position={[0, -2.08, 0]}
        >
          <RandomizedLight
            amount={8}
            radius={6}
            ambient={0.45}
            intensity={0.95}
            position={[5, 8, 5]}
          />
        </AccumulativeShadows>
      </Suspense>
      <Environment preset="warehouse" environmentIntensity={0.72} />
      <OrbitControls
        makeDefault
        enablePan={view !== "top"}
        enableDamping
        dampingFactor={0.08}
        rotateSpeed={0.72}
        zoomSpeed={0.72}
        minDistance={4.2}
        maxDistance={11}
        minPolarAngle={view === "top" ? 0.02 : Math.PI / 5.2}
        maxPolarAngle={view === "top" ? 0.2 : Math.PI / 2.08}
        target={cameraTarget}
      />
    </Canvas>
  );
}

function TechnicalHud({
  state,
  isLarge,
}: {
  state: PreviewState;
  isLarge: boolean;
}) {
  const rows = [
    ["Portée", state.hasReach ? formatMillimeters(state.reach) : "À choisir"],
    [
      "HSF",
      state.hasUnderBeamHeight
        ? formatMillimeters(state.underBeamHeight)
        : "À choisir",
    ],
    ["Charge", state.capacity ?? "À choisir"],
    ["Rotation", state.rotationLabel ?? "À choisir"],
  ];

  return (
    <div className="mt-3 rounded-[1.35rem] border border-slate-800 bg-slate-950 p-4 text-white shadow-lg shadow-slate-900/10">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-cyan-200/90">
          HUD technique
        </p>
        <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-white/70">
          Modèle final
        </span>
      </div>

      <div className={`mt-3 grid gap-x-5 gap-y-3 ${isLarge ? "sm:grid-cols-2 xl:grid-cols-4" : "grid-cols-2"}`}>
        {rows.map(([label, value]) => (
          <div key={label} className="min-w-0 border-b border-white/10 pb-2 last:border-b-0 sm:border-b-0 sm:pb-0">
            <span className="block text-[9px] font-bold uppercase tracking-[0.1em] text-slate-400">
              {label}
            </span>
            <span className={`${isLarge ? "text-sm" : "text-xs"} mt-1 block font-black text-white`}>
              {value}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-3 border-t border-white/15 pt-3">
        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-cyan-200/90">
          Configuration
        </p>
        <p className={`${isLarge ? "text-sm" : "text-xs"} mt-1 font-black text-white`}>
          {state.hasHoist ? "Palan intégré" : "Palan à définir"}
        </p>
      </div>
    </div>
  );
}

function ViewButton({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] shadow-sm backdrop-blur transition hover:-translate-y-0.5 ${
        active
          ? "border-[#007f8f]/20 bg-[#007f8f]/90 text-white"
          : "border-white/70 bg-white/80 text-slate-700 hover:bg-white"
      }`}
    >
      <Icon size={14} />
      {label}
    </button>
  );
}

export default function VisualConfigPreview({
  configuration,
  variant = "compact",
}: VisualConfigPreviewProps) {
  const state = getPreviewState(configuration);
  const isLarge = variant === "large";

  return (
    <div
      className={`overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-lg shadow-slate-200/60 ${
        isLarge ? "p-5" : "p-3"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-orange-600">
            Votre configuration 3D
          </p>
          <h3
            className={`${isLarge ? "text-2xl" : "text-lg"} mt-1 font-black leading-tight text-slate-950`}
          >
            {state.familyLabel}
          </h3>
        </div>
        <span className="shrink-0 rounded-full bg-[#007f8f]/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-[#005466]">
          Modèle final
        </span>
      </div>

      <div
        className={`relative mt-4 overflow-hidden rounded-[1.35rem] border border-slate-200 bg-slate-950 ${
          isLarge ? "h-[520px]" : "h-[340px]"
        }`}
      >
        <div className="pointer-events-none absolute left-4 top-4 z-20 inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-slate-950/75 px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-white/80 shadow-lg backdrop-blur">
          <MousePointer2 size={14} />
          Rotation / zoom
        </div>

        <div className="absolute inset-0">
          <Configurator3DViewer
            configuration={configuration}
            presentation
          />
        </div>
      </div>

      <TechnicalHud state={state} isLarge={isLarge} />

      <div
        className={`mt-3 grid gap-2 ${isLarge ? "sm:grid-cols-4" : "grid-cols-2"}`}
      >
        <MetricPill icon={Box} label="Type" value={state.familyLabel} />
        <MetricPill icon={Weight} label="Charge" value={state.capacity} />
        <MetricPill icon={Ruler} label="Portée" value={state.reachLabel} />
        <MetricPill
          icon={Cuboid}
          label="Palan"
          value={
            state.hasHoist
              ? state.hoistType === "manual"
                ? "Manuel"
                : "Électrique"
              : undefined
          }
        />
      </div>

    </div>
  );
}
