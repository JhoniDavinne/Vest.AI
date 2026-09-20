/**
 * Transformacao visual da peca 3D. Nao calcula fit_score nem tamanho recomendado:
 * consome `evaluatedSize` e `regions[]` ja produzidos pelo RecommendationEngine
 * e o perfil de deformacao do avatar (somente visual).
 */
import type { FitPreviewPayload } from "./types";
import type { FitRegionVisual } from "./fitVisualization";
import { buildRegions } from "./fitVisualization";
import { fitDirection, type FitDirection } from "./regionLegend";
import type { AvatarDeformationProfile } from "./avatarDeformation";
import { clamp } from "./scaleBody";

export interface GarmentBaseMeasurements {
  chest?: number;
  waist?: number;
  length?: number;
  shoulder?: number;
  hip?: number;
}

export interface GarmentTransformProfile {
  scaleX: number;
  scaleY: number;
  scaleZ: number;
  positionY: number;
  torsoScale: number;
  shoulderScale: number;
}

export const GARMENT_TRANSFORM_LIMITS = {
  min: 0.9,
  max: 1.14,
} as const;

/** Escala visual por letra de tamanho. M = baseline. Nao e o score do motor. */
export const SIZE_VISUAL_SCALE: Record<string, number> = {
  xxs: 0.94,
  xs: 0.95,
  s: 0.96,
  m: 1,
  l: 1.04,
  xl: 1.08,
  xxl: 1.1,
  xxxl: 1.12,
};

/** tight = mais junto ao corpo; loose = leve volume. regular/unknown = 1. */
export const FIT_VISUAL_SCALE: Record<FitDirection, number> = {
  tight: 0.98,
  loose: 1.022,
  neutral: 1,
  unknown: 1,
};

export function clampGarmentTransform(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 1;
  return clamp(value, GARMENT_TRANSFORM_LIMITS.min, GARMENT_TRANSFORM_LIMITS.max);
}

export function sizeVisualScale(size: string | null | undefined): number {
  if (!size) return 1;
  const key = size.trim().toLowerCase();
  return SIZE_VISUAL_SCALE[key] ?? 1;
}

export function regionFitScale(region: Pick<FitRegionVisual, "deviation"> | null | undefined): number {
  if (!region) return 1;
  return FIT_VISUAL_SCALE[fitDirection(region)];
}

/**
 * Perfil de transformacao da peca.
 *
 * `size` (S/M/L/XL) e as regioes vêm do payload ja sincronizado com o motor
 * (`applyFitStateToPayload`). Nenhuma formula de caimento e aplicada aqui.
 */
export function computeGarmentTransformProfile(
  payload: FitPreviewPayload,
  avatar: AvatarDeformationProfile,
  options?: { baseMeasurements?: GarmentBaseMeasurements | null },
): GarmentTransformProfile {
  const { regions } = buildRegions(payload.regions);
  const size = sizeVisualScale(payload.garment.evaluatedSize);
  const chestFit = regionFitScale(regions.chest);
  const waistFit = regionFitScale(regions.waist);
  const shoulderFit = regionFitScale(regions.shoulder);
  const lengthFit = regionFitScale(regions.length);

  const base = options?.baseMeasurements;
  const g = payload.garment.measurements;
  const lengthRatio =
    g.length != null && g.length > 0 && base?.length && base.length > 0 ? g.length / base.length : 1;

  const torsoScale = clampGarmentTransform(avatar.chestScale * size * ((chestFit + waistFit) / 2));
  const shoulderScale = clampGarmentTransform(avatar.shoulderScale * size * shoulderFit);
  const lengthSize = 1 + (size - 1) * 0.55;
  const scaleY = clampGarmentTransform(
    avatar.heightScale * lengthSize * lengthFit * clampGarmentTransform(lengthRatio),
  );
  // Apos orientar o avatar: X = largura (peito/ombros), Z = espessura do torso.
  const scaleX = clampGarmentTransform(torsoScale * 0.62 + shoulderScale * 0.38);
  const scaleZ = clampGarmentTransform(1 + (torsoScale - 1) * 0.45);

  return {
    scaleX,
    scaleY,
    scaleZ,
    positionY: 0,
    torsoScale,
    shoulderScale,
  };
}

export function profilesDifferVisually(
  a: GarmentTransformProfile,
  b: GarmentTransformProfile,
  epsilon = 0.008,
): boolean {
  return (
    Math.abs(a.scaleX - b.scaleX) > epsilon ||
    Math.abs(a.scaleY - b.scaleY) > epsilon ||
    Math.abs(a.scaleZ - b.scaleZ) > epsilon ||
    Math.abs(a.torsoScale - b.torsoScale) > epsilon ||
    Math.abs(a.shoulderScale - b.shoulderScale) > epsilon
  );
}
