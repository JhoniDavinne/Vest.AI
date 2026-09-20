"use client";

import * as React from "react";
import type { FitPreviewPayload } from "./types";
import type { ModelsManifest } from "./manifest";
import { isRenderableAsset, resolveGarmentAsset } from "./manifest";
import { computeAvatarDeformationProfile } from "./avatarDeformation";
import { computeGarmentVisualState } from "./garmentVisual";
import { computeGarmentTransformProfile } from "./garmentTransform";
import { GarmentPrimitive } from "./GarmentPrimitive";
import { ModelErrorBoundary } from "./ModelErrorBoundary";
import { preloadGarmentModel, useGarmentModel } from "./useGarmentModel";
import { DEFAULT_MODELS_BASE } from "./constants";

interface GarmentMeshProps {
  payload: FitPreviewPayload;
  modelsBaseUrl?: string;
  manifest?: ModelsManifest | null;
  renderPlaceholders?: boolean;
  onAssetError?: (error: Error) => void;
}

interface GarmentGLBProps {
  url: string;
  payload: FitPreviewPayload;
  manifest: ModelsManifest | null;
}

/**
 * Peca GLB: medidas/tamanho/regioes do motor -> GarmentTransformProfile.
 * Sem simulacao de tecido. O caimento textual continua em `regions[]`.
 */
function GarmentGLB({ url, payload, manifest }: GarmentGLBProps) {
  const visual = React.useMemo(() => computeGarmentVisualState(payload), [payload]);
  const avatar = React.useMemo(() => computeAvatarDeformationProfile(payload.body, manifest?.avatar?.baseMeasurements), [
    payload.body,
    manifest?.avatar?.baseMeasurements,
  ]);
  const category = payload.garment.category;
  const garmentAsset = manifest?.garments[category];
  const transform = React.useMemo(
    () => computeGarmentTransformProfile(payload, avatar, { baseMeasurements: garmentAsset?.baseMeasurements }),
    [payload, avatar, garmentAsset?.baseMeasurements],
  );
  const model = useGarmentModel(url, visual);

  return (
    <group
      name={`garment-glb-${category}`}
      position={[0, transform.positionY, 0]}
      scale={[transform.scaleX, transform.scaleY, transform.scaleZ]}
    >
      <primitive object={model.object} />
    </group>
  );
}

/**
 * Cadeia de fallback: GLB da categoria (manifest, nao-placeholder) -> GarmentPrimitive.
 */
export function GarmentMesh({
  payload,
  modelsBaseUrl = DEFAULT_MODELS_BASE,
  manifest = null,
  renderPlaceholders = false,
  onAssetError,
}: GarmentMeshProps) {
  const category = payload.garment.category;
  const asset = React.useMemo(
    () => resolveGarmentAsset(manifest, category, modelsBaseUrl),
    [manifest, category, modelsBaseUrl],
  );
  const primitive = <GarmentPrimitive payload={payload} />;

  React.useEffect(() => {
    if (isRenderableAsset(asset, renderPlaceholders)) preloadGarmentModel(asset.url);
  }, [asset, renderPlaceholders]);

  if (!isRenderableAsset(asset, renderPlaceholders)) {
    return primitive;
  }

  return (
    <ModelErrorBoundary fallback={primitive} resetKey={asset.url} onError={onAssetError}>
      <React.Suspense fallback={primitive}>
        <GarmentGLB url={asset.url} payload={payload} manifest={manifest} />
      </React.Suspense>
    </ModelErrorBoundary>
  );
}
