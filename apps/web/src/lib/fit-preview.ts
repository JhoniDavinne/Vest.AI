/**
 * Resolucao do estado visual do provador na tela de resultado.
 *
 * Prioridade (sempre dados do motor, nunca recalculados no cliente):
 *  1. `base.comparison[].regions` do tamanho selecionado (sem HTTP);
 *  2. resposta detalhada ja obtida para o tamanho (`persist:false`);
 *  3. `null` → o host precisa consultar a API.
 */
import type { RecommendationResponse } from "@veste-ai/contracts";
import {
  createFitVisualizationState,
  createFitVisualizationStateForSize,
  type FitVisualizationState,
} from "@veste-ai/fit-preview-3d";

export interface PreviewSelection {
  /** Tamanho recomendado pelo motor (nunca muda com a selecao). */
  recommendedSize: string;
  /** Tamanho em visualizacao. */
  selectedPreviewSize: string;
  isRecommended: boolean;
  fit: FitVisualizationState | null;
  /** `true` quando nao ha dados do motor para o tamanho e a API deve ser consultada. */
  needsEngineFetch: boolean;
}

export function resolvePreviewSelection(
  base: RecommendationResponse,
  selectedSize: string | null,
  detailBySize: Record<string, RecommendationResponse> = {},
): PreviewSelection {
  const selectedPreviewSize = selectedSize ?? base.evaluated_size;
  const detail = detailBySize[selectedPreviewSize];
  const fit =
    createFitVisualizationStateForSize(base, selectedPreviewSize) ?? (detail ? createFitVisualizationState(detail) : null);
  return {
    recommendedSize: base.recommended_size,
    selectedPreviewSize,
    isRecommended: selectedPreviewSize === base.recommended_size,
    fit,
    needsEngineFetch: fit === null,
  };
}
