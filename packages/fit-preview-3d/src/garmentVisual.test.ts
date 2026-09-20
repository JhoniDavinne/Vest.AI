import { describe, expect, it } from "vitest";
import type { FitPreviewPayload } from "@veste-ai/contracts";
import {
  computeGarmentVisualState,
  garmentBodyScale,
  GARMENT_SCALE_MAX,
  GARMENT_SCALE_MIN,
  inferMaterial,
} from "./garmentVisual";

function payload(garment: Partial<FitPreviewPayload["garment"]>): FitPreviewPayload {
  return {
    body: { height: 180, chest: 102, waist: 88, hip: 100, shoulder: 45, photoRatios: null },
    garment: {
      category: "tshirt",
      color: "Preto",
      modeling: "regular",
      evaluatedSize: "M",
      measurements: { chest: 111, waist: 111, hip: 107, shoulder: 45, length: 71 },
      ...garment,
    },
    regions: [],
    disclaimer: "",
  };
}

describe("inferMaterial", () => {
  it("classifica tecidos conhecidos e cai em unknown", () => {
    expect(inferMaterial("Malha de algodão penteado 30.1").material).toBe("knit");
    expect(inferMaterial("Jeans stretch").material).toBe("denim");
    expect(inferMaterial("Oxford 100% algodão").material).toBe("woven");
    expect(inferMaterial("").material).toBe("unknown");
    expect(inferMaterial(undefined).material).toBe("unknown");
  });
});

describe("garmentBodyScale", () => {
  it("amortece a diferenca peca/corpo e usa a referencia quando falta medida corporal", () => {
    const [sx] = garmentBodyScale(payload({}));
    // chest 111 vs corpo 102 -> +8.8% amortecido pela metade
    expect(sx).toBeCloseTo(1 + (111 / 102 - 1) * 0.5, 5);
    const p = payload({});
    p.body.chest = null;
    const [sxRef] = garmentBodyScale(p);
    expect(sxRef).toBeCloseTo(1 + (111 / 96 - 1) * 0.5, 5);
    const [, syMissing] = garmentBodyScale(payload({ measurements: {} }));
    expect(syMissing).toBe(1);
  });
});

describe("computeGarmentVisualState", () => {
  it("deriva cor, material e escala limitada", () => {
    const state = computeGarmentVisualState(payload({ fabric: "Malha de algodão", elasticity_pct: 5 }));
    expect(state.color).toBe("#1a1a1a");
    expect(state.material).toBe("knit");
    expect(state.opacity).toBeLessThan(1);
    for (const s of state.scale) {
      expect(s).toBeGreaterThanOrEqual(GARMENT_SCALE_MIN);
      expect(s).toBeLessThanOrEqual(GARMENT_SCALE_MAX);
    }
  });

  it("modelagem oversized aumenta volume, slim reduz, sem ultrapassar limites", () => {
    const base = computeGarmentVisualState(payload({}));
    const oversized = computeGarmentVisualState(payload({ modeling: "oversized" }));
    const slim = computeGarmentVisualState(payload({ modeling: "slim" }));
    expect(oversized.scale[0]).toBeGreaterThan(base.scale[0]);
    expect(slim.scale[0]).toBeLessThan(base.scale[0]);
    const extreme = computeGarmentVisualState(payload({ modeling: "oversized", measurements: { chest: 200, length: 140 } }));
    expect(extreme.scale[0]).toBe(GARMENT_SCALE_MAX);
    expect(extreme.scale[1]).toBe(GARMENT_SCALE_MAX);
  });

  it("elasticidade alta deixa a superficie mais fosca", () => {
    const rigid = computeGarmentVisualState(payload({ fabric: "Oxford", elasticity_pct: 2 }));
    const elastic = computeGarmentVisualState(payload({ fabric: "Oxford", elasticity_pct: 12 }));
    expect(elastic.roughness).toBeGreaterThan(rigid.roughness);
  });
});
