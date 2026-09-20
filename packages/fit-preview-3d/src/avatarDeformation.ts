/**
 * Perfil de deformacao visual do avatar.
 *
 * Nao calcula tamanho, score nem caimento: apenas proporcoes relativas a um
 * corpo-base (manifest.baseMeasurements ou REFERENCE_BODY). O RecommendationEngine
 * continua a unica fonte de verdade do fit.
 */
import { REFERENCE_BODY } from "./constants";
import { clamp } from "./scaleBody";

export interface AvatarBaseMeasurements {
  height: number;
  chest: number;
  waist: number;
  hips: number;
  shoulders: number;
  weight?: number;
}

export interface AvatarDeformationInput {
  height?: number | null;
  chest?: number | null;
  waist?: number | null;
  hip?: number | null;
  hips?: number | null;
  shoulder?: number | null;
  shoulders?: number | null;
  weight?: number | null;
}

export interface AvatarDeformationProfile {
  heightScale: number;
  shoulderScale: number;
  chestScale: number;
  waistScale: number;
  hipScale: number;
  bodyMassScale: number;
}

export type AdapterKind = "morph" | "skeleton" | "regional" | "global";

export type BoneClass = "shoulder" | "chest" | "waist" | "hip" | "protected" | "ignore";

export const DEFAULT_BASE_MEASUREMENTS: AvatarBaseMeasurements = {
  height: REFERENCE_BODY.height,
  chest: REFERENCE_BODY.chest,
  waist: REFERENCE_BODY.waist,
  hips: REFERENCE_BODY.hip,
  shoulders: REFERENCE_BODY.shoulder,
  weight: REFERENCE_BODY.weight,
};

/** Limites antropometricos visuais (evita cabeca/maos/pes absurdos). */
export const DEFORMATION_LIMITS = {
  height: { min: 0.88, max: 1.16 },
  xz: { min: 0.9, max: 1.14 },
  mass: { min: 0.94, max: 1.1 },
} as const;

const BONE_DAMPING = 0.68;

export function clampScale(value: number, min: number, max: number, fallback = 1): number {
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return clamp(value, min, max);
}

function ratio(value: number | null | undefined, base: number): number {
  if (value == null || !Number.isFinite(value) || value <= 0 || base <= 0) return 1;
  return value / base;
}

function dampTowardOne(scale: number, damping = BONE_DAMPING): number {
  return 1 + (scale - 1) * damping;
}

export function resolveBaseMeasurements(override?: Partial<AvatarBaseMeasurements> | null): AvatarBaseMeasurements {
  if (!override) return DEFAULT_BASE_MEASUREMENTS;
  return {
    height: override.height ?? DEFAULT_BASE_MEASUREMENTS.height,
    chest: override.chest ?? DEFAULT_BASE_MEASUREMENTS.chest,
    waist: override.waist ?? DEFAULT_BASE_MEASUREMENTS.waist,
    hips: override.hips ?? DEFAULT_BASE_MEASUREMENTS.hips,
    shoulders: override.shoulders ?? DEFAULT_BASE_MEASUREMENTS.shoulders,
    weight: override.weight ?? DEFAULT_BASE_MEASUREMENTS.weight,
  };
}

/**
 * Converte medidas (cm / kg) em escalas visuais limitadas.
 * `weight` so altera `bodyMassScale` (volume global moderado), nunca o fit.
 */
export function computeAvatarDeformationProfile(
  input: AvatarDeformationInput,
  base?: Partial<AvatarBaseMeasurements> | null,
): AvatarDeformationProfile {
  const ref = resolveBaseMeasurements(base);
  const hipValue = input.hip ?? input.hips;
  const shoulderValue = input.shoulder ?? input.shoulders;
  const { height: hLim, xz, mass } = DEFORMATION_LIMITS;

  const heightScale = clampScale(ratio(input.height, ref.height), hLim.min, hLim.max);
  const shoulderScale = clampScale(ratio(shoulderValue, ref.shoulders), xz.min, xz.max);
  const chestScale = clampScale(ratio(input.chest, ref.chest), xz.min, xz.max);
  const waistScale = clampScale(ratio(input.waist, ref.waist), xz.min, xz.max);
  const hipScale = clampScale(ratio(hipValue, ref.hips), xz.min, xz.max);

  let bodyMassScale = 1;
  if (input.weight != null && input.weight > 0 && input.height != null && input.height > 0 && ref.weight && ref.weight > 0) {
    const bmi = input.weight / (input.height / 100) ** 2;
    const refBmi = ref.weight / (ref.height / 100) ** 2;
    bodyMassScale = clampScale(bmi / refBmi, mass.min, mass.max);
  }

  return { heightScale, shoulderScale, chestScale, waistScale, hipScale, bodyMassScale };
}

/** Classifica um no do GLB (Rigify / Mixamo / nomes genericos). */
export function classifyBone(name: string): BoneClass {
  const n = name.trim();
  if (!n) return "ignore";
  // GLTFLoader remove pontos (spine.001 → spine001, shoulder.L → shoulderL).
  // Rigify: spine.004/005 = pescoco/cabeca.
  if (
    /head|neck|hand|foot|toe|heel|finger|thumb|eye|jaw|index|middle|ring|pinky|f_index|f_middle|f_ring|f_pinky/i.test(n) ||
    /spine\.?00[45]$/i.test(n) ||
    /spine0[45]$/i.test(n)
  ) {
    return "protected";
  }
  if (/shoulder|clavicle|collar/i.test(n)) return "shoulder";
  if (/spine\.?00[23]$/i.test(n) || /spine0[23]$/i.test(n) || /^(chest|spine2|spine02|upperchest|spine_02)$/i.test(n)) {
    return "chest";
  }
  if (/spine\.?001$/i.test(n) || /spine01$/i.test(n) || /^(waist|abdomen|belly|spine1|spine_01)$/i.test(n)) {
    return "waist";
  }
  if (/^spine$/i.test(n) || /^(hips|pelvis|hip)([._]?[lr])?$/i.test(n)) return "hip";
  return "ignore";
}

export function dampedBoneScale(
  kind: BoneClass,
  profile: AvatarDeformationProfile,
): { x: number; y: number; z: number } | null {
  if (kind === "protected" || kind === "ignore") return null;
  const mass = dampTowardOne(profile.bodyMassScale, 0.5);
  const pick =
    kind === "shoulder"
      ? profile.shoulderScale
      : kind === "chest"
        ? profile.chestScale
        : kind === "waist"
          ? profile.waistScale
          : profile.hipScale;
  const xz = dampTowardOne(pick) * mass;
  return { x: xz, y: 1, z: xz };
}

export function selectAdapterKind(capabilities: { hasMorphs: boolean; torsoBoneCount: number; namedRegionMeshes: number }): AdapterKind {
  if (capabilities.hasMorphs) return "morph";
  if (capabilities.torsoBoneCount >= 3) return "skeleton";
  if (capabilities.namedRegionMeshes >= 3) return "regional";
  return "global";
}

export function profilesDifferVisually(a: AvatarDeformationProfile, b: AvatarDeformationProfile, epsilon = 0.012): boolean {
  return (
    Math.abs(a.heightScale - b.heightScale) > epsilon ||
    Math.abs(a.shoulderScale - b.shoulderScale) > epsilon ||
    Math.abs(a.chestScale - b.chestScale) > epsilon ||
    Math.abs(a.waistScale - b.waistScale) > epsilon ||
    Math.abs(a.hipScale - b.hipScale) > epsilon ||
    Math.abs(a.bodyMassScale - b.bodyMassScale) > epsilon
  );
}
