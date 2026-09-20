"use client";

import * as React from "react";
import type { Product, RecommendationResponse } from "@veste-ai/contracts";
import { buildPreviewPayloadFromRecommendation, mergeFitPreviewPayload } from "@veste-ai/fit-preview-3d";
import { useProfile } from "@/lib/profile";
import { FitPreview3DLazy } from "@/components/fit/fit-preview-3d-lazy";

export function ProductFitPreview({
  product,
  recommendation,
}: {
  product: Product;
  recommendation: RecommendationResponse;
}) {
  const { user } = useProfile();
  const payload = React.useMemo(() => {
    const fallback = buildPreviewPayloadFromRecommendation(recommendation, product, {
      body: user?.measurements ?? undefined,
      photo: user?.photo_analysis,
      garmentMeasurements: product.sizes.find((s) => s.size_label === recommendation.evaluated_size)?.measurements,
    });
    return mergeFitPreviewPayload(recommendation, fallback);
  }, [product, recommendation, user]);

  if (!payload) return null;

  return (
    <div className="rounded-3xl border border-border bg-paper p-5 shadow-soft">
      <p className="eyebrow">Provador visual estimado</p>
      <p className="mt-1 text-sm text-stone">
        Tamanho {recommendation.evaluated_size} · rotação com mouse para inspecionar o caimento.
      </p>
      <div className="mt-4">
        <FitPreview3DLazy payload={payload} size="medium" regionsFallback={recommendation.regions} />
      </div>
    </div>
  );
}
