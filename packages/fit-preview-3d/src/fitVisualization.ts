/**
 * FitVisualizationState — camada tipada entre a resposta do motor e o 3D.
 *
 *   RecommendationResponse ──createFitVisualizationState──▶ FitVisualizationState ──▶ FitPreview3D
 *
 * Regras:
 *  - normaliza SOMENTE dados ja retornados pela API (nenhum calculo de caimento);
 *  - valores ausentes permanecem `null`; nada e inferido;
 *  - a troca de tamanho usa `comparison[].regions` quando presente; se faltar,
 *    devolve `null` para que o host consulte a API (`persist: false`).
 */
import type {
  Confidence,
  FitPreviewPayload,
  RecommendationResponse,
  RegionDetail,
  RegionKey,
  RegionStatus,
  SizeComparison,
} from "@veste-ai/contracts";

/** Regioes visualizaveis. `sleeve` existe na ficha tecnica mas o motor nao a avalia (fica null). */
export type FitRegionKey = RegionKey | "sleeve";

export const FIT_REGION_KEYS: readonly FitRegionKey[] = ["chest", "waist", "hip", "shoulder", "length", "sleeve"];

export interface FitRegionVisual {
  region: FitRegionKey;
  status: RegionStatus;
  /** Rotulo do status vindo do motor (ex.: "Compativel"). */
  label: string;
  body: number | null;
  garment: number | null;
  ease: number | null;
  designEase: number | null;
  deviation: number | null;
  score: number | null;
  note: string;
}

export type FitVisualizationSource = "response" | "comparison" | "payload";

export interface FitVisualizationState {
  size: string;
  sku: string;
  /** fit_score do motor para este tamanho (0-10). */
  fitScore: number | null;
  /** Confianca da analise (nivel da recomendacao, nao por tamanho). */
  confidence: Confidence | null;
  recommendedSize: string | null;
  recommendedSku: string | null;
  /** `true` quando `size` e o tamanho recomendado pelo motor. */
  isRecommended: boolean;
  /** Regioes por chave; ausentes = null. */
  regions: Record<FitRegionKey, FitRegionVisual | null>;
  /** Regioes na ordem retornada pelo motor (somente as presentes). */
  regionList: FitRegionVisual[];
  source: FitVisualizationSource;
}

export interface SizeOption {
  size: string;
  sku: string;
  fitScore: number;
  recommended: boolean;
  /** `true` quando `comparison[]` ja traz `regions` para este tamanho (troca sem HTTP). */
  hasRegions: boolean;
}

function toNumberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function toRegionVisual(detail: RegionDetail): FitRegionVisual {
  return {
    region: detail.region,
    status: detail.status,
    label: detail.label ?? "",
    body: toNumberOrNull(detail.body),
    garment: toNumberOrNull(detail.garment),
    ease: toNumberOrNull(detail.ease),
    designEase: toNumberOrNull(detail.design_ease),
    deviation: toNumberOrNull(detail.deviation),
    score: toNumberOrNull(detail.score),
    note: detail.note ?? "",
  };
}

function emptyRegions(): Record<FitRegionKey, FitRegionVisual | null> {
  return { chest: null, waist: null, hip: null, shoulder: null, length: null, sleeve: null };
}

export function buildRegions(details: RegionDetail[] | undefined | null): {
  regions: Record<FitRegionKey, FitRegionVisual | null>;
  regionList: FitRegionVisual[];
} {
  const regions = emptyRegions();
  const regionList: FitRegionVisual[] = [];
  for (const detail of details ?? []) {
    if (!detail || !(detail.region in regions)) continue;
    const visual = toRegionVisual(detail);
    regions[visual.region] = visual;
    regionList.push(visual);
  }
  return { regions, regionList };
}

/** Estado do tamanho avaliado na resposta (campos do topo de `RecommendationResponse`). */
export function createFitVisualizationState(response: RecommendationResponse): FitVisualizationState {
  const { regions, regionList } = buildRegions(response.regions);
  return {
    size: response.evaluated_size,
    sku: response.evaluated_sku,
    fitScore: toNumberOrNull(response.fit_score),
    confidence: response.confidence ?? null,
    recommendedSize: response.recommended_size ?? null,
    recommendedSku: response.recommended_sku ?? null,
    isRecommended: response.evaluated_size === response.recommended_size,
    regions,
    regionList,
    source: "response",
  };
}

/** Estado derivado de um item de `comparison` (dados do motor para outro tamanho). */
export function createFitVisualizationStateFromComparison(
  response: RecommendationResponse,
  entry: SizeComparison,
): FitVisualizationState | null {
  if (!entry.regions || entry.regions.length === 0) return null;
  const { regions, regionList } = buildRegions(entry.regions);
  return {
    size: entry.size,
    sku: entry.sku,
    fitScore: toNumberOrNull(entry.fit_score),
    confidence: response.confidence ?? null,
    recommendedSize: response.recommended_size ?? null,
    recommendedSku: response.recommended_sku ?? null,
    isRecommended: entry.recommended || entry.size === response.recommended_size,
    regions,
    regionList,
    source: "comparison",
  };
}

/**
 * Estado para um tamanho especifico:
 *  - tamanho avaliado → dados do topo da resposta;
 *  - outro tamanho → `comparison[]` se trouxer `regions`;
 *  - caso contrario → `null` (host deve chamar a API com `persist: false`).
 */
export function createFitVisualizationStateForSize(
  response: RecommendationResponse,
  size: string,
): FitVisualizationState | null {
  if (size === response.evaluated_size) return createFitVisualizationState(response);
  const entry = response.comparison?.find((c) => c.size === size);
  if (!entry) return null;
  return createFitVisualizationStateFromComparison(response, entry);
}

/** Estado minimo a partir de um `FitPreviewPayload` (quando nao ha resposta completa). */
export function createFitVisualizationStateFromPayload(payload: FitPreviewPayload): FitVisualizationState {
  const { regions, regionList } = buildRegions(payload.regions);
  return {
    size: payload.garment.evaluatedSize,
    sku: "",
    fitScore: null,
    confidence: null,
    recommendedSize: null,
    recommendedSku: null,
    isRecommended: false,
    regions,
    regionList,
    source: "payload",
  };
}

/** Opcoes de tamanho (ordem do motor) para o seletor. */
export function listSizeOptions(response: RecommendationResponse): SizeOption[] {
  return (response.comparison ?? []).map((entry) => ({
    size: entry.size,
    sku: entry.sku,
    fitScore: entry.fit_score,
    recommended: entry.recommended || entry.size === response.recommended_size,
    hasRegions: Boolean(entry.regions && entry.regions.length > 0) || entry.size === response.evaluated_size,
  }));
}

/** Converte o estado de volta para `RegionDetail[]` (formato do contrato HTTP), sem perdas. */
export function fitStateToRegionDetails(state: FitVisualizationState): RegionDetail[] {
  return state.regionList.map(
    (r): RegionDetail => ({
      region: r.region as RegionKey,
      status: r.status,
      label: r.label,
      body: r.body,
      garment: r.garment,
      ease: r.ease,
      design_ease: r.designEase,
      deviation: r.deviation,
      score: r.score,
      note: r.note,
    }),
  );
}

/**
 * Aplica o estado de um tamanho ao payload do provador: regioes e medidas da
 * peca passam a ser as do tamanho selecionado (valores do motor), sem alterar
 * corpo, categoria, cor ou tecido.
 */
export function applyFitStateToPayload(payload: FitPreviewPayload, state: FitVisualizationState): FitPreviewPayload {
  if (state.source === "payload" && state.size === payload.garment.evaluatedSize) return payload;
  const m = payload.garment.measurements;
  const sameSize = state.size === payload.garment.evaluatedSize;
  // Medida da peca: valor do motor para a regiao; se ausente, so mantem a do payload
  // quando o tamanho e o mesmo (para outro tamanho nao ha dado — fica null).
  const pick = (key: FitRegionKey, fallback: number | null | undefined): number | null => {
    const fromEngine = state.regions[key]?.garment;
    if (fromEngine != null) return fromEngine;
    return sameSize ? (fallback ?? null) : null;
  };
  return {
    ...payload,
    garment: {
      ...payload.garment,
      evaluatedSize: state.size,
      measurements: {
        chest: pick("chest", m.chest),
        waist: pick("waist", m.waist),
        hip: pick("hip", m.hip),
        shoulder: pick("shoulder", m.shoulder),
        length: pick("length", m.length),
        sleeve: sameSize ? (m.sleeve ?? null) : null,
        width: sameSize ? (m.width ?? null) : null,
      },
    },
    regions: fitStateToRegionDetails(state),
  };
}
