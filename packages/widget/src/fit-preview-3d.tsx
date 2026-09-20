"use client";

import * as React from "react";
import type { FitPreviewPayload, RecommendationResponse } from "@veste-ai/contracts";
import {
  buildPreviewPayloadFromRecommendation,
  createFitVisualizationStateForSize,
  listSizeOptions,
  mergeFitPreviewPayload,
} from "@veste-ai/fit-preview-3d";

const FitPreview3D = React.lazy(() =>
  import("@veste-ai/fit-preview-3d").then((m) => ({ default: m.FitPreview3D })),
);

export interface WidgetFitPreview3DProps {
  result: RecommendationResponse;
  /** Tamanho em foco no widget (recommendedSize x selectedPreviewSize). */
  selectedSize: string;
  /** Troca de tamanho vinda do seletor 3D (sem HTTP quando comparison traz regions). */
  onSelectSize?: (size: string) => void;
  enabled?: boolean;
}

export function WidgetFitPreview3D({ result, selectedSize, onSelectSize, enabled = true }: WidgetFitPreview3DProps) {
  const payload = result.fit_preview ?? null;
  const fit = React.useMemo(() => createFitVisualizationStateForSize(result, selectedSize), [result, selectedSize]);
  const sizes = React.useMemo(() => listSizeOptions(result).filter((o) => o.hasRegions), [result]);

  if (!enabled || !payload) return null;

  return (
    <div className="vf-preview3d" data-testid="vf-preview3d">
      <p className="vf-sub" style={{ marginBottom: 8 }}>
        Provador visual estimado · arraste para rotacionar
      </p>
      <React.Suspense
        fallback={
          <div className="vf-preview3d-loading" style={{ minHeight: 320, display: "grid", placeItems: "center" }}>
            Carregando provador 3D…
          </div>
        }
      >
        <FitPreview3D
          payload={payload}
          fit={fit}
          sizes={onSelectSize ? sizes : undefined}
          onSelectSize={onSelectSize}
          size="compact"
          showDisclaimer
        />
      </React.Suspense>
    </div>
  );
}

export function buildWidgetPreviewPayload(
  result: Parameters<typeof buildPreviewPayloadFromRecommendation>[0],
  product: Parameters<typeof buildPreviewPayloadFromRecommendation>[1],
): FitPreviewPayload | null {
  const fallback = buildPreviewPayloadFromRecommendation(result, product);
  return mergeFitPreviewPayload(result, fallback);
}
