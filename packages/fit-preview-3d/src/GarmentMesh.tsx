"use client";

import * as React from "react";
import type { FitPreviewPayload } from "./types";
import type { ModelsManifest } from "./manifest";
import { isRenderableAsset, resolveGarmentAsset } from "./manifest";
import { computeBodyScale } from "./scaleBody";
import { computeGarmentVisualState } from "./garmentVisual";
import { GarmentPrimitive } from "./GarmentPrimitive";
import { ModelErrorBoundary } from "./ModelErrorBoundary";
import { useGarmentModel } from "./useGarmentModel";
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
}

/**
 * Peca GLB por categoria: garment.category -> manifest -> GLB -> materiais/escala
 * derivados de `computeGarmentVisualState` (cor, tecido, elasticidade, modelagem,
 * medidas). Sem simulacao de tecido; o caimento regional e do motor.
 */
function GarmentGLB({ url, payload }: GarmentGLBProps) {
  const visual = React.useMemo(() => computeGarmentVisualState(payload), [payload]);
  const factors = React.useMemo(() => computeBodyScale(payload), [payload]);
  const model = useGarmentModel(url, visual);

  // Acompanha a altura do avatar para manter alinhamento vertical com o corpo.
  return (
    <group name={`garment-glb-${payload.garment.category}`} scale={[1, factors.height, 1]}>
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

  if (!isRenderableAsset(asset, renderPlaceholders)) {
    return primitive;
  }

  return (
    <ModelErrorBoundary fallback={primitive} resetKey={asset.url} onError={onAssetError}>
      <React.Suspense fallback={primitive}>
        <GarmentGLB url={asset.url} payload={payload} />
      </React.Suspense>
    </ModelErrorBoundary>
  );
}
