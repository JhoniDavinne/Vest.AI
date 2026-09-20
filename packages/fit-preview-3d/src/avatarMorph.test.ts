import { describe, expect, it } from "vitest";
import type { FitPreviewPayload } from "@veste-ai/contracts";
import {
  applyMorphState,
  computeAvatarMorphState,
  DEFAULT_MORPH_TARGET_MAPPING,
  factorToMorph,
  mergeMorphMapping,
  MORPH_AXES,
  type MorphableMesh,
} from "./avatarMorph";
import { computeBodyScale } from "./scaleBody";
import { REFERENCE_BODY } from "./constants";

function payload(body: Partial<FitPreviewPayload["body"]>): FitPreviewPayload {
  return {
    body: { height: null, chest: null, waist: null, hip: null, shoulder: null, photoRatios: null, ...body },
    garment: { category: "tshirt", color: "Preto", modeling: "regular", evaluatedSize: "M", measurements: {} },
    regions: [],
    disclaimer: "",
  };
}

describe("factorToMorph", () => {
  it("mapeia a referencia para 0 e limita a [-1, 1]", () => {
    expect(factorToMorph(1)).toBe(0);
    expect(factorToMorph(1.11)).toBeCloseTo(0.5, 5);
    expect(factorToMorph(0.89)).toBeCloseTo(-0.5, 5);
    expect(factorToMorph(5)).toBe(1);
    expect(factorToMorph(0)).toBe(-1);
    expect(factorToMorph(Number.NaN)).toBe(0);
  });
});

describe("computeAvatarMorphState", () => {
  it("corpo de referencia produz estado neutro", () => {
    const state = computeAvatarMorphState(computeBodyScale(payload({ ...REFERENCE_BODY })));
    for (const axis of MORPH_AXES) expect(state[axis]).toBeCloseTo(0, 5);
  });

  it("medidas maiores geram estado positivo, menores negativo, sempre dentro do limite", () => {
    const larger = computeAvatarMorphState(computeBodyScale(payload({ height: 195, chest: 118, waist: 100, hip: 112, shoulder: 52 })));
    const smaller = computeAvatarMorphState(computeBodyScale(payload({ height: 158, chest: 84, waist: 70, hip: 88, shoulder: 39 })));
    expect(larger.chest).toBeGreaterThan(0);
    expect(larger.height).toBeGreaterThan(0);
    expect(smaller.chest).toBeLessThan(0);
    expect(smaller.hip).toBeLessThan(0);
    for (const axis of MORPH_AXES) {
      expect(Math.abs(larger[axis])).toBeLessThanOrEqual(1);
      expect(Math.abs(smaller[axis])).toBeLessThanOrEqual(1);
    }
  });

  it("medidas ausentes mantem o eixo neutro", () => {
    const state = computeAvatarMorphState(computeBodyScale(payload({ chest: 120 })));
    expect(state.waist).toBe(0);
    expect(state.height).toBe(0);
    expect(state.chest).toBeGreaterThan(0);
  });
});

describe("applyMorphState", () => {
  const state = { height: 0, chest: 0.6, waist: -0.4, hip: 0, shoulder: 0.2, torsoLeg: 0 };

  it("escreve pares plus/minus e zera o lado oposto", () => {
    const mesh: MorphableMesh = {
      morphTargetDictionary: { chest_plus: 0, chest_minus: 1, waist_plus: 2, waist_minus: 3 },
      morphTargetInfluences: [0.9, 0.9, 0.9, 0.9],
    };
    const result = applyMorphState(mesh, state);
    expect(mesh.morphTargetInfluences).toEqual([0.6, 0, 0, 0.4]);
    expect(result.applied).toEqual(["chest", "waist"]);
  });

  it("usa alvo unico bipolar quando nao ha par", () => {
    const mesh: MorphableMesh = { morphTargetDictionary: { shoulder: 0 }, morphTargetInfluences: [0] };
    applyMorphState(mesh, state);
    expect(mesh.morphTargetInfluences?.[0]).toBeCloseTo(0.6, 5);
  });

  it("ignora meshes sem morph targets e alvos ausentes", () => {
    expect(applyMorphState({}, state).applied).toEqual([]);
    const mesh: MorphableMesh = { morphTargetDictionary: { Outro: 0 }, morphTargetInfluences: [0.3] };
    expect(applyMorphState(mesh, state).applied).toEqual([]);
    expect(mesh.morphTargetInfluences?.[0]).toBe(0.3);
  });

  it("aceita mapeamento customizado vindo do manifest", () => {
    const mapping = mergeMorphMapping({ chest: { plus: "ChestWide", minus: "ChestNarrow" } });
    expect(mapping.waist).toEqual(DEFAULT_MORPH_TARGET_MAPPING.waist);
    const mesh: MorphableMesh = { morphTargetDictionary: { ChestWide: 0, ChestNarrow: 1 }, morphTargetInfluences: [0, 0] };
    applyMorphState(mesh, state, mapping);
    expect(mesh.morphTargetInfluences).toEqual([0.6, 0]);
  });
});
