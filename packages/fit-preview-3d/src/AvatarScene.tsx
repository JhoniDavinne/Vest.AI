"use client";

import * as React from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { FitPreviewPayload } from "./types";
import type { ModelsManifest } from "./manifest";
import { AvatarBody } from "./AvatarBody";
import { GarmentMesh } from "./GarmentMesh";
import { RegionalOverlay } from "./RegionalOverlay";
import { CameraRig, type CameraCommand } from "./CameraRig";
import { DEFAULT_MODELS_BASE } from "./constants";
import { CAMERA_DEFAULT_POSITION, CAMERA_MAX_DISTANCE, CAMERA_MIN_DISTANCE, CAMERA_TARGET } from "./cameraViews";
import { WebGLContextGuard } from "./WebGLContextGuard";

interface AvatarSceneProps {
  payload: FitPreviewPayload;
  modelsBaseUrl?: string;
  manifest?: ModelsManifest | null;
  renderPlaceholders?: boolean;
  height: number;
  cameraCommand?: CameraCommand | null;
  onContextLost?: () => void;
  onAssetError?: (error: Error) => void;
}

function SceneContent({
  payload,
  modelsBaseUrl,
  manifest,
  renderPlaceholders,
  cameraCommand,
  onContextLost,
  onAssetError,
}: {
  payload: FitPreviewPayload;
  modelsBaseUrl: string;
  manifest: ModelsManifest | null;
  renderPlaceholders: boolean;
  cameraCommand: CameraCommand | null;
  onContextLost?: () => void;
  onAssetError?: (error: Error) => void;
}) {
  return (
    <>
      {onContextLost ? <WebGLContextGuard onContextLost={onContextLost} /> : null}
      <CameraRig command={cameraCommand} />
      <ambientLight intensity={0.72} />
      <directionalLight position={[2.5, 5, 3.5]} intensity={0.85} />
      <directionalLight position={[-3, 2, -2]} intensity={0.25} />
      <group position={[0, -0.85, 0]}>
        <AvatarBody
          payload={payload}
          modelsBaseUrl={modelsBaseUrl}
          manifest={manifest}
          renderPlaceholders={renderPlaceholders}
          onAssetError={onAssetError}
        />
        <GarmentMesh
          payload={payload}
          modelsBaseUrl={modelsBaseUrl}
          manifest={manifest}
          renderPlaceholders={renderPlaceholders}
          onAssetError={onAssetError}
        />
        <RegionalOverlay payload={payload} />
      </group>
      <OrbitControls
        enablePan={false}
        enableZoom
        minDistance={CAMERA_MIN_DISTANCE}
        maxDistance={CAMERA_MAX_DISTANCE}
        minPolarAngle={Math.PI / 3.2}
        maxPolarAngle={Math.PI / 1.75}
        target={[CAMERA_TARGET[0], CAMERA_TARGET[1], CAMERA_TARGET[2]]}
        makeDefault
      />
    </>
  );
}

export function AvatarScene({
  payload,
  modelsBaseUrl = DEFAULT_MODELS_BASE,
  manifest = null,
  renderPlaceholders = false,
  height,
  cameraCommand = null,
  onContextLost,
  onAssetError,
}: AvatarSceneProps) {
  return (
    <Canvas
      dpr={[1, 1.5]}
      frameloop="always"
      camera={{
        position: [CAMERA_DEFAULT_POSITION[0], CAMERA_DEFAULT_POSITION[1], CAMERA_DEFAULT_POSITION[2]],
        fov: 38,
        near: 0.1,
        far: 20,
      }}
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
      <SceneContent
        payload={payload}
        modelsBaseUrl={modelsBaseUrl}
        manifest={manifest}
        renderPlaceholders={renderPlaceholders}
        cameraCommand={cameraCommand}
        onContextLost={onContextLost}
        onAssetError={onAssetError}
      />
    </Canvas>
  );
}
