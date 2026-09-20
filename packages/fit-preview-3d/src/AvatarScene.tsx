"use client";

import * as React from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { AxesHelper, Box3, Box3Helper, Vector3 } from "three";
import type { FitPreviewPayload } from "./types";
import type { ModelsManifest } from "./manifest";
import type { FitRegionVisual } from "./fitVisualization";
import { AvatarBody } from "./AvatarBody";
import { GarmentMesh } from "./GarmentMesh";
import { RegionalOverlay } from "./RegionalOverlay";
import { CameraRig, type CameraCommand } from "./CameraRig";
import { DEFAULT_MODELS_BASE, type PreviewRendererKind } from "./constants";
import { CAMERA_DEFAULT_POSITION } from "./cameraViews";
import {
  computeCameraFraming,
  defaultCameraFraming,
  framingBoundsFromAvatar,
  type CameraFraming,
} from "./cameraFraming";
import { WebGLContextGuard } from "./WebGLContextGuard";
import { isSceneDebugEnabled, type ObjectBounds } from "./modelUtils";

export const SCENE_BACKGROUND = "#e3dcd2";

interface AvatarSceneProps {
  payload: FitPreviewPayload;
  regions?: FitRegionVisual[];
  modelsBaseUrl?: string;
  manifest?: ModelsManifest | null;
  renderPlaceholders?: boolean;
  height: number;
  cameraCommand?: CameraCommand | null;
  onContextLost?: () => void;
  onContextRestored?: () => void;
  onAssetError?: (error: Error) => void;
  onRendererChange?: (kind: PreviewRendererKind) => void;
}

function AvatarBoxHelper({ bounds }: { bounds: ObjectBounds }) {
  const helper = React.useMemo(() => {
    const box = new Box3(
      new Vector3(-bounds.width / 2, bounds.minY, -bounds.depth / 2),
      new Vector3(bounds.width / 2, bounds.minY + bounds.height, bounds.depth / 2),
    );
    return new Box3Helper(box, 0x3d8f6a);
  }, [bounds]);
  return <primitive object={helper} />;
}

/** Box3Helper da peca nomeada; so existe em development. */
function NamedObjectBoxHelper({ name, color }: { name: string; color: number }) {
  const box = React.useMemo(() => new Box3(), []);
  const helper = React.useMemo(() => new Box3Helper(box, color), [box, color]);
  const scene = useThree((state) => state.scene);

  useFrame(() => {
    const node = scene.getObjectByName(name);
    if (!node) return;
    node.updateWorldMatrix(true, true);
    box.setFromObject(node);
    helper.updateMatrixWorld(true);
  });

  return <primitive object={helper} />;
}

function SceneDebugHelpers({ bodyBounds }: { bodyBounds: ObjectBounds | null }) {
  const axes = React.useMemo(() => new AxesHelper(0.45), []);
  if (!isSceneDebugEnabled()) return null;
  return (
    <group name="scene-debug">
      <primitive object={axes} position={[0, bodyBounds?.minY ?? 0, 0]} />
      {bodyBounds ? <AvatarBoxHelper bounds={bodyBounds} /> : null}
      <NamedObjectBoxHelper name="garment-root" color={0xc4623a} />
    </group>
  );
}

function SceneContent({
  payload,
  regions,
  modelsBaseUrl,
  manifest,
  renderPlaceholders,
  cameraCommand,
  onContextLost,
  onContextRestored,
  onAssetError,
  onRendererChange,
  framing,
  bodyBounds,
  onBounds,
}: {
  payload: FitPreviewPayload;
  regions?: FitRegionVisual[];
  modelsBaseUrl: string;
  manifest: ModelsManifest | null;
  renderPlaceholders: boolean;
  cameraCommand: CameraCommand | null;
  onContextLost?: () => void;
  onContextRestored?: () => void;
  onAssetError?: (error: Error) => void;
  onRendererChange?: (kind: PreviewRendererKind) => void;
  framing: CameraFraming;
  bodyBounds: ObjectBounds | null;
  onBounds: (bounds: ObjectBounds) => void;
}) {
  return (
    <>
      {onContextLost ? <WebGLContextGuard onContextLost={onContextLost} onContextRestored={onContextRestored} /> : null}
      <CameraRig command={cameraCommand} framing={framing} />
      <color attach="background" args={[SCENE_BACKGROUND]} />
      <ambientLight intensity={0.78} />
      <directionalLight position={[2.5, 5, 3.5]} intensity={0.95} />
      <directionalLight position={[-3, 2, -2]} intensity={0.28} />
      <hemisphereLight args={["#f4efe8", "#8a847c", 0.35]} />
      <group>
        <AvatarBody
          payload={payload}
          modelsBaseUrl={modelsBaseUrl}
          manifest={manifest}
          renderPlaceholders={renderPlaceholders}
          onAssetError={onAssetError}
          onBounds={onBounds}
          onRendererChange={onRendererChange}
        />
        <GarmentMesh
          payload={payload}
          modelsBaseUrl={modelsBaseUrl}
          manifest={manifest}
          renderPlaceholders={renderPlaceholders}
          onAssetError={onAssetError}
        />
        <RegionalOverlay payload={payload} regions={regions} bodyBounds={bodyBounds} />
        <SceneDebugHelpers bodyBounds={bodyBounds} />
      </group>
      <OrbitControls
        enablePan={false}
        enableZoom
        minDistance={framing.minDistance}
        maxDistance={framing.maxDistance}
        minPolarAngle={Math.PI / 3.4}
        maxPolarAngle={Math.PI / 1.7}
        target={[framing.target[0], framing.target[1], framing.target[2]]}
        makeDefault
      />
    </>
  );
}

export function AvatarScene({
  payload,
  regions,
  modelsBaseUrl = DEFAULT_MODELS_BASE,
  manifest = null,
  renderPlaceholders = false,
  height,
  cameraCommand = null,
  onContextLost,
  onContextRestored,
  onAssetError,
  onRendererChange,
}: AvatarSceneProps) {
  const [framing, setFraming] = React.useState<CameraFraming>(() => defaultCameraFraming());
  const [bodyBounds, setBodyBounds] = React.useState<ObjectBounds | null>(null);

  const lastBounds = React.useRef<ObjectBounds | null>(null);
  const handleBounds = React.useCallback((bounds: ObjectBounds) => {
    const prev = lastBounds.current;
    if (
      prev &&
      Math.abs(prev.height - bounds.height) < 0.012 &&
      Math.abs(prev.width - bounds.width) < 0.012 &&
      Math.abs(prev.minY - bounds.minY) < 0.012
    ) {
      return;
    }
    lastBounds.current = bounds;
    setBodyBounds(bounds);
    if (isSceneDebugEnabled() && typeof console !== "undefined") {
      console.info("[fit-preview-3d] avatar bounds", {
        width: Number(bounds.width.toFixed(3)),
        height: Number(bounds.height.toFixed(3)),
        depth: Number(bounds.depth.toFixed(3)),
        minY: Number(bounds.minY.toFixed(3)),
        center: bounds.center,
      });
    }
    setFraming(computeCameraFraming(framingBoundsFromAvatar(bounds)));
  }, []);

  return (
    <Canvas
      dpr={[1, 1.5]}
      frameloop="always"
      camera={{
        position: [CAMERA_DEFAULT_POSITION[0], CAMERA_DEFAULT_POSITION[1], CAMERA_DEFAULT_POSITION[2]],
        fov: 38,
        near: 0.1,
        far: 40,
      }}
      style={{
        width: "100%",
        height,
        display: "block",
        background: "linear-gradient(180deg,#f7f4ef 0%,#ece7df 100%)",
      }}
      gl={{
        antialias: true,
        alpha: false,
        powerPreference: "low-power",
        failIfMajorPerformanceCaveat: false,
      }}
    >
      <SceneContent
        payload={payload}
        regions={regions}
        modelsBaseUrl={modelsBaseUrl}
        manifest={manifest}
        renderPlaceholders={renderPlaceholders}
        cameraCommand={cameraCommand}
        onContextLost={onContextLost}
        onContextRestored={onContextRestored}
        onAssetError={onAssetError}
        onRendererChange={onRendererChange}
        framing={framing}
        bodyBounds={bodyBounds}
        onBounds={handleBounds}
      />
    </Canvas>
  );
}
