"use client";

import * as React from "react";
import type { FitPreviewPayload } from "./types";
import type { ModelsManifest } from "./manifest";
import { isRenderableAsset, resolveAvatarAsset } from "./manifest";
import { computeBodyScale } from "./scaleBody";
import { StylizedSilhouette } from "./StylizedSilhouette";
import { ModelErrorBoundary } from "./ModelErrorBoundary";
import { useAvatarModel } from "./useAvatarModel";
import { DEFAULT_MODELS_BASE } from "./constants";

interface AvatarBodyProps {
  payload: FitPreviewPayload;
  modelsBaseUrl?: string;
  manifest?: ModelsManifest | null;
  /** Permite exibir assets marcados como placeholder (apenas validacao do pipeline). */
  renderPlaceholders?: boolean;
  onAssetError?: (error: Error) => void;
}

interface AvatarGLBProps {
  url: string;
  payload: FitPreviewPayload;
  manifest: ModelsManifest | null;
}

/**
 * Avatar GLB parametrico: medidas -> computeBodyScale -> AvatarMorphState -> morph targets.
 * Quando o GLB nao possui morph targets (avatar rigido) a altura continua sendo
 * representada por escala vertical, como na silhueta.
 */
function AvatarGLB({ url, payload, manifest }: AvatarGLBProps) {
  const factors = React.useMemo(() => computeBodyScale(payload), [payload]);
  const model = useAvatarModel(url, factors, manifest?.avatar?.morphTargets ?? null);
  const heightViaMorph = model.appliedAxes.includes("height");
  const scaleY = heightViaMorph ? 1 : factors.height;

  return (
    <group name="avatar-glb" scale={[1, scaleY, 1]}>
      <primitive object={model.object} />
    </group>
  );
}

/**
 * Digital twin estilizado. Cadeia de fallback:
 *   GLB real (manifest, nao-placeholder) -> StylizedSilhouette.
 * O componente nunca lanca: erros de asset sao capturados pela boundary.
 */
export function AvatarBody({
  payload,
  modelsBaseUrl = DEFAULT_MODELS_BASE,
  manifest = null,
  renderPlaceholders = false,
  onAssetError,
}: AvatarBodyProps) {
  const asset = React.useMemo(() => resolveAvatarAsset(manifest, modelsBaseUrl), [manifest, modelsBaseUrl]);
  const silhouette = <StylizedSilhouette payload={payload} />;

  if (!isRenderableAsset(asset, renderPlaceholders)) {
    return silhouette;
  }

  return (
    <ModelErrorBoundary fallback={silhouette} resetKey={asset.url} onError={onAssetError}>
      <React.Suspense fallback={silhouette}>
        <AvatarGLB url={asset.url} payload={payload} manifest={manifest} />
      </React.Suspense>
    </ModelErrorBoundary>
  );
}

export { STATUS_COLOR_HEX } from "./constants";
