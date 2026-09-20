import type { BodyScaleFactors, FitPreviewPayload } from "./types";
import { REFERENCE_BODY } from "./constants";

const PHOTO_RATIO_MIN = 0.78;
const PHOTO_RATIO_MAX = 1.38;
const BODY_SCALE_MIN = 0.82;
const BODY_SCALE_MAX = 1.22;

function safeRatio(value: number | null | undefined, reference: number, fallback = 1): number {
  if (value == null || value <= 0) return fallback;
  return value / reference;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function clampPhotoRatio(value: number | null | undefined, fallback = 1): number {
  if (value == null || !Number.isFinite(value)) return fallback;
  return clamp(value, PHOTO_RATIO_MIN, PHOTO_RATIO_MAX);
}

export function clampBodyScale(value: number, fallback = 1): number {
  if (!Number.isFinite(value)) return fallback;
  return clamp(value, BODY_SCALE_MIN, BODY_SCALE_MAX);
}

/** Largura do tronco — media de ombro/peito, sem multiplicar os dois (evita disco horizontal). */
export function torsoWidthScale(factors: BodyScaleFactors, statusScale = 1): number {
  const blended = (factors.shoulder + factors.chest) / 2;
  return clampBodyScale(blended * statusScale);
}

export function regionRadiusScale(baseRadius: number, factor: number): number {
  return clamp(baseRadius * factor, baseRadius * BODY_SCALE_MIN, baseRadius * BODY_SCALE_MAX);
}

export function computeBodyScale(payload: FitPreviewPayload): BodyScaleFactors {
  const { body } = payload;
  const heightScale = safeRatio(body.height, REFERENCE_BODY.height);
  const chestScale = safeRatio(body.chest, REFERENCE_BODY.chest);
  const waistScale = safeRatio(body.waist, REFERENCE_BODY.waist);
  const hipScale = safeRatio(body.hip, REFERENCE_BODY.hip);
  const shoulderScale = safeRatio(body.shoulder, REFERENCE_BODY.shoulder);

  const photo = body.photoRatios;
  const waistHip = clampPhotoRatio(photo?.waist_hip_ratio);
  const torsoLeg = clampPhotoRatio(photo?.torso_leg_ratio);

  return {
    height: clampBodyScale(heightScale),
    chest: clampBodyScale(chestScale),
    waist: clampBodyScale(waistScale * waistHip),
    hip: clampBodyScale(hipScale),
    shoulder: clampBodyScale(shoulderScale),
    torsoLeg,
  };
}

export function parseGarmentColor(color: string): string {
  const trimmed = color.trim();
  if (/^#[0-9a-fA-F]{3,8}$/.test(trimmed)) return trimmed;
  const named: Record<string, string> = {
    preto: "#1a1a1a",
    black: "#1a1a1a",
    branco: "#f5f5f0",
    white: "#f5f5f0",
    azul: "#2f4a7a",
    blue: "#2f4a7a",
    verde: "#3d6b4f",
    green: "#3d6b4f",
    vermelho: "#8b3a3a",
    red: "#8b3a3a",
    bege: "#c4b59a",
    beige: "#c4b59a",
    cinza: "#6b7078",
    gray: "#6b7078",
    grey: "#6b7078",
    marrom: "#6b4f3a",
    brown: "#6b4f3a",
    rosa: "#c48a9a",
    pink: "#c48a9a",
  };
  return named[trimmed.toLowerCase()] ?? "#4a5568";
}

export function garmentScale(payload: FitPreviewPayload): [number, number, number] {
  const m = payload.garment.measurements;
  const chest = m.chest ?? REFERENCE_BODY.chest;
  const waist = m.waist ?? REFERENCE_BODY.waist;
  const length = m.length ?? 70;
  const sx = chest / REFERENCE_BODY.chest;
  const sy = length / 70;
  const sz = (waist / REFERENCE_BODY.waist + sx) / 2;
  return [sx, sy, sz];
}
