/**
 * Layout das faixas regionais a partir da bounding box do avatar.
 * As cores/status continuam vindo do motor; aqui so ha posicao visual.
 */
import type { RegionKey } from "@veste-ai/contracts";
import { REGION_BAND_RADIUS, REGION_BAND_Y } from "./silhouette";

export interface RegionBandLayout {
  y: Partial<Record<RegionKey, number>>;
  radius: Partial<Record<RegionKey, number>>;
}

/** Fracao da altura (pes → cabeca) para cada faixa antropometrica. */
export const REGION_HEIGHT_FRACTION: Record<RegionKey, number> = {
  shoulder: 0.81,
  chest: 0.71,
  waist: 0.6,
  hip: 0.52,
  length: 0.28,
};

/** Raio da faixa como fracao da meia-largura do bbox. */
export const REGION_RADIUS_FRACTION: Record<RegionKey, number> = {
  shoulder: 0.42,
  chest: 0.38,
  waist: 0.32,
  hip: 0.36,
  length: 0.24,
};

export interface BodyBounds {
  minY: number;
  height: number;
  width: number;
}

export function regionLayoutFromBounds(bounds: BodyBounds): RegionBandLayout {
  const height = Math.max(0.2, bounds.height);
  // T-pose: a bbox inclui os bracos; o torso e ~38% da altura.
  const torsoWidth = Math.min(Math.max(0.2, bounds.width), height * 0.42);
  const halfWidth = Math.max(0.12, torsoWidth / 2);
  const y: Partial<Record<RegionKey, number>> = {};
  const radius: Partial<Record<RegionKey, number>> = {};
  (Object.keys(REGION_HEIGHT_FRACTION) as RegionKey[]).forEach((key) => {
    y[key] = bounds.minY + height * REGION_HEIGHT_FRACTION[key];
    radius[key] = Math.max(0.08, halfWidth * REGION_RADIUS_FRACTION[key]);
  });
  return { y, radius };
}

export function defaultRegionLayout(): RegionBandLayout {
  return { y: { ...REGION_BAND_Y }, radius: { ...REGION_BAND_RADIUS } };
}
