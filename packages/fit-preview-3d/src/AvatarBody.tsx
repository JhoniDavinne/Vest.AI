"use client";

import * as React from "react";
import { Group } from "three";
import type { FitPreviewPayload } from "./types";
import type { ModelsManifest } from "./manifest";
import { isRenderableAsset, resolveAvatarAsset } from "./manifest";
import { computeBodyScale } from "./scaleBody";
import { computeAvatarDeformationProfile } from "./avatarDeformation";
import { StylizedSilhouette } from "./StylizedSilhouette";
import { ModelErrorBoundary } from "./ModelErrorBoundary";
import { preloadAvatarModel, useAvatarModel } from "./useAvatarModel";
import { DEFAULT_MODELS_BASE, type PreviewRendererKind } from "./constants";
import { measureObject, type ObjectBounds } from "./modelUtils";
import { SILHOUETTE_CENTER_Y, SILHOUETTE_HEIGHT } from "./silhouette";

interface AvatarBodyProps {
  payload: FitPreviewPayload;
  modelsBaseUrl?: string;
  manifest?: ModelsManifest | null;
  /** Permite exibir assets marcados como placeholder (apenas validacao do pipeline). */
  renderPlaceholders?: boolean;
  onAssetError?: (error: Error) => void;
  /** Bounding box do avatar na cena (para camera e overlay). */
  onBounds?: (bounds: ObjectBounds) => void;
  onRendererChange?: (kind: PreviewRendererKind) => void;
}

interface AvatarGLBProps {
  url: string;
  payload: FitPreviewPayload;
  manifest: ModelsManifest | null;
  onBounds?: (bounds: ObjectBounds) => void;
  onRendererChange?: (kind: PreviewRendererKind) => void;
}

function silhouetteBounds(): ObjectBounds {
  return {
    height: SILHOUETTE_HEIGHT,
    width: 0.52,
    depth: 0.28,
    minY: SILHOUETTE_CENTER_Y - SILHOUETTE_HEIGHT / 2,
    center: { x: 0, y: SILHOUETTE_CENTER_Y, z: 0 } as ObjectBounds["center"],
  };
}

/**
 * Avatar GLB: medidas -> deformation profile -> adapter (morph/skeleton/regional).
 * A altura usa escala Y do grupo quando o morph de height nao existe.
 */
function AvatarGLB({ url, payload, manifest, onBounds, onRendererChange }: AvatarGLBProps) {
  const factors = React.useMemo(() => computeBodyScale(payload), [payload]);
  const profile = React.useMemo(
    () => computeAvatarDeformationProfile(payload.body, manifest?.avatar?.baseMeasurements),
    [payload.body, manifest?.avatar?.baseMeasurements],
  );
  const model = useAvatarModel(url, factors, profile, manifest?.avatar?.morphTargets ?? null);
  const heightViaMorph = model.appliedAxes.includes("height");
  const scaleY = heightViaMorph ? 1 : profile.heightScale;
  const groupRef = React.useRef<Group>(null);

  React.useLayoutEffect(() => {
    onRendererChange?.("human");
    const node = groupRef.current;
    if (!node) return;
    node.updateWorldMatrix(true, true);
    onBounds?.(measureObject(node));
  }, [model.object, scaleY, profile, onBounds, onRendererChange]);

  return (
    <group ref={groupRef} name="avatar-glb" scale={[1, scaleY, 1]}>
      <primitive object={model.object} />
    </group>
  );
}

/**
 * Digital twin. Cadeia de fallback:
 *   GLB real (manifest, nao-placeholder) -> StylizedSilhouette.
 * O componente nunca lanca: erros de asset sao capturados pela boundary.
 */
export function AvatarBody({
  payload,
  modelsBaseUrl = DEFAULT_MODELS_BASE,
  manifest = null,
  renderPlaceholders = false,
  onAssetError,
  onBounds,
  onRendererChange,
}: AvatarBodyProps) {
  const asset = React.useMemo(() => resolveAvatarAsset(manifest, modelsBaseUrl), [manifest, modelsBaseUrl]);
  const silhouette = <StylizedSilhouette payload={payload} />;

  React.useEffect(() => {
    if (isRenderableAsset(asset, renderPlaceholders)) preloadAvatarModel(asset.url);
  }, [asset, renderPlaceholders]);

  React.useLayoutEffect(() => {
    if (!isRenderableAsset(asset, renderPlaceholders)) {
      onBounds?.(silhouetteBounds());
      onRendererChange?.("silhouette");
    }
  }, [asset, renderPlaceholders, onBounds, onRendererChange]);

  if (!isRenderableAsset(asset, renderPlaceholders)) {
    return silhouette;
  }

  return (
    <ModelErrorBoundary
      fallback={silhouette}
      resetKey={asset.url}
      onError={(error) => {
        onBounds?.(silhouetteBounds());
        onRendererChange?.("silhouette");
        onAssetError?.(error);
      }}
    >
      <React.Suspense fallback={silhouette}>
        <AvatarGLB
          url={asset.url}
          payload={payload}
          manifest={manifest}
          onBounds={onBounds}
          onRendererChange={onRendererChange}
        />
      </React.Suspense>
    </ModelErrorBoundary>
  );
}

export { STATUS_COLOR_HEX } from "./constants";
