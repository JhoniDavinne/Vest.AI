/**
 * Camada entre os fatores corporais (`computeBodyScale`) e os morph targets
 * de um avatar GLB.
 *
 *   body measurements -> computeBodyScale -> AvatarMorphState -> morphTargetInfluences
 *
 * A camada e desacoplada do asset: o mapeamento de nomes de morph targets vem
 * do manifest (ou de um padrao) e qualquer alvo ausente e simplesmente ignorado.
 * Nao ha classificacao estetica: apenas proporcoes relativas a um corpo de
 * referencia, sempre com limites seguros.
 */
import type { BodyScaleFactors } from "./types";

export type MorphAxis = "height" | "chest" | "waist" | "hip" | "shoulder" | "torsoLeg";

export const MORPH_AXES: readonly MorphAxis[] = ["height", "chest", "waist", "hip", "shoulder", "torsoLeg"];

/** Estado visual normalizado: -1 (menor que a referencia) .. 0 (referencia) .. +1 (maior). */
export type AvatarMorphState = Record<MorphAxis, number>;

export interface MorphTargetNames {
  /** Alvo acionado quando o eixo e positivo (corpo maior que a referencia). */
  plus?: string;
  /** Alvo acionado quando o eixo e negativo. */
  minus?: string;
  /** Alvo unico bipolar (0.5 = referencia), usado quando nao ha par plus/minus. */
  single?: string;
}

export type MorphTargetMapping = Record<MorphAxis, MorphTargetNames>;

/** Convencao padrao de nomes (`<eixo>_plus` / `<eixo>_minus`). */
export const DEFAULT_MORPH_TARGET_MAPPING: MorphTargetMapping = {
  height: { plus: "height_plus", minus: "height_minus", single: "height" },
  chest: { plus: "chest_plus", minus: "chest_minus", single: "chest" },
  waist: { plus: "waist_plus", minus: "waist_minus", single: "waist" },
  hip: { plus: "hip_plus", minus: "hip_minus", single: "hip" },
  shoulder: { plus: "shoulder_plus", minus: "shoulder_minus", single: "shoulder" },
  torsoLeg: { plus: "torso_plus", minus: "torso_minus", single: "torso" },
};

/** Amplitude de fator que corresponde a 100% do morph (alinhado ao clamp de scaleBody). */
export const MORPH_FACTOR_SPAN = 0.22;
export const MORPH_INFLUENCE_LIMIT = 1;

export function clampMorph(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(MORPH_INFLUENCE_LIMIT, Math.max(-MORPH_INFLUENCE_LIMIT, value));
}

/** Converte um fator multiplicativo (1 = referencia) em estado -1..1. */
export function factorToMorph(factor: number): number {
  return clampMorph((factor - 1) / MORPH_FACTOR_SPAN);
}

export function computeAvatarMorphState(factors: BodyScaleFactors): AvatarMorphState {
  return {
    height: factorToMorph(factors.height),
    chest: factorToMorph(factors.chest),
    waist: factorToMorph(factors.waist),
    hip: factorToMorph(factors.hip),
    shoulder: factorToMorph(factors.shoulder),
    torsoLeg: factorToMorph(factors.torsoLeg),
  };
}

export function mergeMorphMapping(override?: Partial<MorphTargetMapping> | null): MorphTargetMapping {
  if (!override) return DEFAULT_MORPH_TARGET_MAPPING;
  const merged = { ...DEFAULT_MORPH_TARGET_MAPPING };
  for (const axis of MORPH_AXES) {
    const names = override[axis];
    if (names) merged[axis] = { ...names };
  }
  return merged;
}

/** Alvo minimo compativel com `THREE.Mesh` (evita depender de three nos testes puros). */
export interface MorphableMesh {
  morphTargetDictionary?: Record<string, number>;
  morphTargetInfluences?: number[];
}

export interface ApplyMorphResult {
  /** Eixos que encontraram pelo menos um morph target no mesh. */
  applied: MorphAxis[];
}

/**
 * Escreve o estado nos `morphTargetInfluences` do mesh. Alvos ausentes sao
 * ignorados; alvos de eixos presentes mas com estado oposto sao zerados para
 * evitar acumulo entre re-renderizacoes.
 */
export function applyMorphState(
  mesh: MorphableMesh,
  state: AvatarMorphState,
  mapping: MorphTargetMapping = DEFAULT_MORPH_TARGET_MAPPING,
): ApplyMorphResult {
  const dict = mesh.morphTargetDictionary;
  const influences = mesh.morphTargetInfluences;
  const applied: MorphAxis[] = [];
  if (!dict || !influences) return { applied };

  const set = (name: string | undefined, value: number): boolean => {
    if (!name) return false;
    const index = dict[name];
    if (index === undefined || index < 0 || index >= influences.length) return false;
    influences[index] = clampMorph(value);
    return true;
  };

  for (const axis of MORPH_AXES) {
    const names = mapping[axis];
    const value = clampMorph(state[axis]);
    let touched = false;

    const hasPlus = set(names.plus, Math.max(0, value));
    const hasMinus = set(names.minus, Math.max(0, -value));
    touched = hasPlus || hasMinus;

    if (!touched) {
      // Alvo unico: 0.5 = referencia, 0 = minimo, 1 = maximo.
      touched = set(names.single, 0.5 + value / 2);
    }
    if (touched) applied.push(axis);
  }
  return { applied };
}
