"use client";

import * as React from "react";
import type { FitPreviewPayload } from "@veste-ai/contracts";
import { buildPreviewPayloadFromRecommendation, mergeFitPreviewPayload } from "@veste-ai/fit-preview-3d";

const FitPreview3D = React.lazy(() =>
  import("@veste-ai/fit-preview-3d").then((m) => ({ default: m.FitPreview3D })),
);

export function WidgetFitPreview3D({
  payload,
  enabled = true,
}: {
  payload: FitPreviewPayload | null;
  enabled?: boolean;
}) {
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
        <FitPreview3D payload={payload} size="compact" showDisclaimer />
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
