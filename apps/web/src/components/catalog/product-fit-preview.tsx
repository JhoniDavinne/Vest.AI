"use client";

import * as React from "react";
import type { Product, RecommendationResponse } from "@veste-ai/contracts";
import {
  buildPreviewPayloadFromRecommendation,
  createFitVisualizationStateForSize,
  listSizeOptions,
  mergeFitPreviewPayload,
} from "@veste-ai/fit-preview-3d";
import { useProfile } from "@/lib/profile";
import { FitPreview3DLazy } from "@/components/fit/fit-preview-3d-lazy";

/**
 * Previa do provador na PDP. A troca de tamanho usa somente `comparison[].regions`
 * da recomendacao ja obtida (dados do motor); tamanhos sem detalhe voltam ao avaliado.
 */
export function ProductFitPreview({
  product,
  recommendation,
}: {
  product: Product;
  recommendation: RecommendationResponse;
}) {
  const { user } = useProfile();
  // Selecao vinculada a recomendacao atual: ao chegar outra recomendacao, volta ao tamanho avaliado.
  const selectionKey = `${recommendation.product_id}:${recommendation.evaluated_sku}`;
  const [selection, setSelection] = React.useState<{ key: string; size: string } | null>(null);
  const selectedSize = selection?.key === selectionKey ? selection.size : recommendation.evaluated_size;
  const setSelectedSize = React.useCallback((size: string) => setSelection({ key: selectionKey, size }), [selectionKey]);

  const payload = React.useMemo(() => {
    const fallback = buildPreviewPayloadFromRecommendation(recommendation, product, {
      body: user?.measurements ?? undefined,
      photo: user?.photo_analysis,
      garmentMeasurements: product.sizes.find((s) => s.size_label === recommendation.evaluated_size)?.measurements,
    });
    return mergeFitPreviewPayload(recommendation, fallback);
  }, [product, recommendation, user]);

  const fit = React.useMemo(
    () => createFitVisualizationStateForSize(recommendation, selectedSize),
    [recommendation, selectedSize],
  );
  const sizes = React.useMemo(
    () => listSizeOptions(recommendation).filter((option) => option.hasRegions),
    [recommendation],
  );

  if (!payload) return null;

  return (
    <div className="rounded-3xl border border-border bg-paper p-5 shadow-soft">
      <p className="eyebrow">Provador visual estimado</p>
      <p className="mt-1 text-sm text-stone">
        Tamanho {fit?.size ?? recommendation.evaluated_size} · rotação com mouse para inspecionar o caimento.
      </p>
      <div className="mt-4">
        <FitPreview3DLazy
          payload={payload}
          fit={fit}
          sizes={sizes}
          onSelectSize={setSelectedSize}
          size="medium"
          regionsFallback={recommendation.regions}
        />
      </div>
    </div>
  );
}
