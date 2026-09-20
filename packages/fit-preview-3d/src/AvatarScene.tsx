"use client";

import * as React from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { FitPreviewPayload } from "./types";
import { AvatarBody } from "./AvatarBody";
import { GarmentMesh } from "./GarmentMesh";
import { RegionalOverlay } from "./RegionalOverlay";
import { DEFAULT_MODELS_BASE } from "./constants";
import { WebGLContextGuard } from "./WebGLContextGuard";

interface AvatarSceneProps {
  payload: FitPreviewPayload;
  modelsBaseUrl?: string;
  height: number;
  onContextLost?: () => void;
}

function SceneContent({
  payload,
  modelsBaseUrl,
  onContextLost,
}: {
  payload: FitPreviewPayload;
  modelsBaseUrl: string;
  onContextLost?: () => void;
}) {
  return (
    <>
      {onContextLost ? <WebGLContextGuard onContextLost={onContextLost} /> : null}
      <ambientLight intensity={0.72} />
      <directionalLight position={[2.5, 5, 3.5]} intensity={0.85} />
      <directionalLight position={[-3, 2, -2]} intensity={0.25} />
      <group position={[0, -0.85, 0]}>
        <React.Suspense fallback={null}>
          <AvatarBody payload={payload} modelsBaseUrl={modelsBaseUrl} />
        </React.Suspense>
        <GarmentMesh payload={payload} modelsBaseUrl={modelsBaseUrl} />
        <RegionalOverlay payload={payload} />
      </group>
      <OrbitControls
        enablePan={false}
        minDistance={2}
        maxDistance={4.2}
        minPolarAngle={Math.PI / 3.2}
        maxPolarAngle={Math.PI / 1.75}
        target={[0, 0.62, 0]}
        makeDefault
      />
    </>
  );
}

export function AvatarScene({
  payload,
  modelsBaseUrl = DEFAULT_MODELS_BASE,
  height,
  onContextLost,
}: AvatarSceneProps) {
  return (
    <Canvas
      dpr={1}
      frameloop="always"
      camera={{ position: [0, 0.9, 2.55], fov: 38, near: 0.1, far: 20 }}
      style={{
        width: "100%",
        height,
        display: "block",
        background: "linear-gradient(180deg,#f7f4ef 0%,#ece7df 100%)",
      }}
      gl={{
        antialias: false,
        alpha: false,
        powerPreference: "low-power",
        failIfMajorPerformanceCaveat: false,
      }}
    >
      <SceneContent payload={payload} modelsBaseUrl={modelsBaseUrl} onContextLost={onContextLost} />
    </Canvas>
  );
}
