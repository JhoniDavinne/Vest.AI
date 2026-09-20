import type { ReactNode } from "react";
import type {
  Category,
  FitPreviewPayload,
  GarmentMeasurement,
  Modeling,
  PhotoAnalysis,
  Product,
  RecommendationResponse,
  RegionDetail,
  User,
} from "@veste-ai/contracts";
import { FIT_PREVIEW_DISCLAIMER } from "./constants";
import type { FitVisualizationState, SizeOption } from "./fitVisualization";

export interface BodyScaleFactors {
  height: number;
  chest: number;
  waist: number;
  hip: number;
  shoulder: number;
  torsoLeg: number;
}

export type FitPreviewSize = "full" | "medium" | "compact";

export interface FitPreview3DProps {
  payload: FitPreviewPayload;
  size?: FitPreviewSize;
  /** Base dos assets 3D; `${modelsBaseUrl}/manifest.json` localiza avatar e pecas. */
  modelsBaseUrl?: string;
  className?: string;
  /** Exibido quando WebGL nao esta disponivel ou o contexto e perdido. */
  fallback?: ReactNode;
  showDisclaimer?: boolean;
  /** Barra de vistas (frente/lateral/costas), zoom e reset. Padrao: true. */
  showControls?: boolean;
  /**
   * Exibe assets marcados como `placeholder` no manifest. Apenas para validar o
   * pipeline de carregamento — nunca ativar em producao.
   */
  renderPlaceholders?: boolean;
  /** Notificado quando um GLB falha e a cena cai para a representacao estilizada. */
  onAssetError?: (error: Error) => void;
  /**
   * Estado visual normalizado do motor (`createFitVisualizationState*`). Quando
   * informado, regioes e medidas da peca do `payload` sao substituidas pelas do
   * tamanho deste estado. Sem ele, o componente usa `payload.regions`.
   */
  fit?: FitVisualizationState | null;
  /** Tamanhos disponiveis (`listSizeOptions(response)`) para o seletor HTML. */
  sizes?: SizeOption[];
  /** Chamado quando o usuario escolhe outro tamanho no seletor. */
  onSelectSize?: (size: string) => void;
  /** Tamanho cujo estado esta sendo carregado pelo host (fallback HTTP). */
  loadingSize?: string | null;
  /** Legenda textual "Regiao — Caimento". Padrao: true. */
  showLegend?: boolean;
  /** Cabecalho com tamanho/score do motor. Padrao: true quando `fit` e informado. */
  showSummary?: boolean;
}

export function buildPreviewPayloadFromRecommendation(
  response: RecommendationResponse,
  product: Pick<Product, "category" | "color" | "modeling"> & Partial<Pick<Product, "fabric" | "elasticity_pct">>,
  options?: {
    body?: {
      height?: number | null;
      weight?: number | null;
      chest?: number | null;
      waist?: number | null;
      hip?: number | null;
      shoulder?: number | null;
    };
    photo?: PhotoAnalysis | null;
    garmentMeasurements?: GarmentMeasurement;
  },
): FitPreviewPayload {
  const bodyFromRegions = Object.fromEntries(
    response.regions.filter((r) => r.body != null).map((r) => [r.region, r.body]),
  );
  const garmentFromRegions = Object.fromEntries(
    response.regions.filter((r) => r.garment != null).map((r) => [r.region, r.garment]),
  );

  return {
    body: {
      height: options?.body?.height ?? null,
      chest: options?.body?.chest ?? (bodyFromRegions.chest as number | undefined) ?? null,
      waist: options?.body?.waist ?? (bodyFromRegions.waist as number | undefined) ?? null,
      hip: options?.body?.hip ?? (bodyFromRegions.hip as number | undefined) ?? null,
      shoulder: options?.body?.shoulder ?? (bodyFromRegions.shoulder as number | undefined) ?? null,
      weight: options?.body?.weight ?? null,
      photoRatios: options?.photo
        ? {
            shoulder_hip_ratio: options.photo.shoulder_hip_ratio,
            waist_hip_ratio: options.photo.waist_hip_ratio,
            torso_leg_ratio: options.photo.torso_leg_ratio,
          }
        : null,
    },
    garment: {
      category: product.category,
      color: product.color,
      modeling: product.modeling,
      fabric: product.fabric ?? "",
      elasticity_pct: product.elasticity_pct ?? null,
      evaluatedSize: response.evaluated_size,
      measurements: options?.garmentMeasurements ?? {
        chest: garmentFromRegions.chest as number | undefined,
        waist: garmentFromRegions.waist as number | undefined,
        hip: garmentFromRegions.hip as number | undefined,
        shoulder: garmentFromRegions.shoulder as number | undefined,
        length: garmentFromRegions.length as number | undefined,
      },
    },
    regions: response.regions,
    disclaimer: FIT_PREVIEW_DISCLAIMER,
  };
}

export function buildPreviewPayloadFromUserAndProduct(
  user: User,
  product: Product,
  response: RecommendationResponse,
): FitPreviewPayload {
  const size = product.sizes.find((s) => s.size_label === response.evaluated_size);
  return buildPreviewPayloadFromRecommendation(response, product, {
    body: user.measurements ?? undefined,
    photo: user.photo_analysis,
    garmentMeasurements: size?.measurements,
  });
}

export function mergeFitPreviewPayload(
  response: RecommendationResponse,
  fallback?: FitPreviewPayload | null,
): FitPreviewPayload | null {
  if (response.fit_preview) return response.fit_preview;
  return fallback ?? null;
}

export type { Category, Modeling, RegionDetail, FitPreviewPayload };
