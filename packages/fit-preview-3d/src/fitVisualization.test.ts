import { describe, expect, it } from "vitest";
import type { RecommendationResponse, RegionDetail, SizeComparison } from "@veste-ai/contracts";
import {
  applyFitStateToPayload,
  createFitVisualizationState,
  createFitVisualizationStateForSize,
  createFitVisualizationStateFromPayload,
  FIT_REGION_KEYS,
  listSizeOptions,
} from "./fitVisualization";
import { buildPreviewPayloadFromRecommendation } from "./types";

function region(partial: Partial<RegionDetail> & Pick<RegionDetail, "region" | "status">): RegionDetail {
  return {
    label: "",
    body: null,
    garment: null,
    ease: null,
    design_ease: null,
    deviation: null,
    score: null,
    note: "",
    ...partial,
  };
}

const REGIONS_M: RegionDetail[] = [
  region({ region: "chest", status: "good", body: 102, garment: 111, ease: 9, design_ease: 10, deviation: -1, score: 0.98, label: "Compativel" }),
  region({ region: "waist", status: "attention", body: 88, garment: 111, ease: 23, design_ease: 16, deviation: 7, score: 0.6 }),
  region({ region: "shoulder", status: "ease_recommended", body: 45, garment: 43, ease: -2, design_ease: 1, deviation: -3, score: 0.4 }),
  region({ region: "length", status: "not_evaluated" }),
];

const REGIONS_L: RegionDetail[] = [
  region({ region: "chest", status: "attention", body: 102, garment: 116, ease: 14, design_ease: 10, deviation: 4, score: 0.85 }),
  region({ region: "waist", status: "attention", body: 88, garment: 116, ease: 28, design_ease: 16, deviation: 12, score: 0.3 }),
];

function comparison(size: string, fit: number, recommended: boolean, regions?: RegionDetail[]): SizeComparison {
  return {
    sku: `SKU-${size}`,
    size,
    fit_score: fit,
    recommended,
    components: { measurements: 0.9, modeling: 0.9, elasticity: 1, visual_proportion: null, preference: 0.8 },
    regional_analysis: Object.fromEntries((regions ?? []).map((r) => [r.region, r.status])) as SizeComparison["regional_analysis"],
    regions,
  };
}

const RESPONSE = {
  evaluated_size: "M",
  evaluated_sku: "SKU-M",
  recommended_size: "M",
  recommended_sku: "SKU-M",
  fit_score: 8.7,
  confidence: "medium",
  regions: REGIONS_M,
  comparison: [
    comparison("S", 6.1, false, [region({ region: "chest", status: "ease_recommended", deviation: -6, score: 0.3 })]),
    comparison("M", 8.7, true, REGIONS_M),
    comparison("L", 7.4, false, REGIONS_L),
    comparison("XL", 5.2, false), // sem regions (resposta antiga / incompleta)
  ],
} as unknown as RecommendationResponse;

describe("createFitVisualizationState", () => {
  it("normaliza o tamanho avaliado sem recalcular nada", () => {
    const state = createFitVisualizationState(RESPONSE);
    expect(state.size).toBe("M");
    expect(state.fitScore).toBe(8.7);
    expect(state.confidence).toBe("medium");
    expect(state.isRecommended).toBe(true);
    expect(state.source).toBe("response");
    expect(state.regions.chest).toMatchObject({ body: 102, garment: 111, ease: 9, designEase: 10, deviation: -1, score: 0.98, status: "good" });
    expect(state.regionList.map((r) => r.region)).toEqual(["chest", "waist", "shoulder", "length"]);
  });

  it("regiao inexistente permanece null (inclusive sleeve) e valores ausentes nao sao inventados", () => {
    const state = createFitVisualizationState(RESPONSE);
    expect(state.regions.hip).toBeNull();
    expect(state.regions.sleeve).toBeNull();
    expect(state.regions.length).toMatchObject({ status: "not_evaluated", body: null, deviation: null, score: null });
    expect(Object.keys(state.regions).sort()).toEqual([...FIT_REGION_KEYS].sort());
  });
});

describe("createFitVisualizationStateForSize (troca de tamanho)", () => {
  it("usa comparison[] quando traz regions — sem nova chamada HTTP", () => {
    const state = createFitVisualizationStateForSize(RESPONSE, "L");
    expect(state).not.toBeNull();
    expect(state?.size).toBe("L");
    expect(state?.sku).toBe("SKU-L");
    expect(state?.fitScore).toBe(7.4);
    expect(state?.source).toBe("comparison");
    expect(state?.regions.chest?.garment).toBe(116);
    expect(state?.regions.shoulder).toBeNull();
  });

  it("diferencia recomendado e selecionado", () => {
    const l = createFitVisualizationStateForSize(RESPONSE, "L");
    expect(l?.isRecommended).toBe(false);
    expect(l?.recommendedSize).toBe("M");
    const m = createFitVisualizationStateForSize(RESPONSE, "M");
    expect(m?.isRecommended).toBe(true);
    expect(m?.source).toBe("response");
  });

  it("retorna null quando comparison nao tem regions ou o tamanho nao existe (host consulta a API)", () => {
    expect(createFitVisualizationStateForSize(RESPONSE, "XL")).toBeNull();
    expect(createFitVisualizationStateForSize(RESPONSE, "XXL")).toBeNull();
  });
});

describe("listSizeOptions", () => {
  it("lista tamanhos na ordem do motor com flags de recomendado e disponibilidade de regions", () => {
    const options = listSizeOptions(RESPONSE);
    expect(options.map((o) => o.size)).toEqual(["S", "M", "L", "XL"]);
    expect(options.find((o) => o.size === "M")).toMatchObject({ recommended: true, hasRegions: true, fitScore: 8.7 });
    expect(options.find((o) => o.size === "XL")).toMatchObject({ recommended: false, hasRegions: false });
  });
});

describe("applyFitStateToPayload", () => {
  const product = { category: "tshirt", color: "Preto", modeling: "regular" } as const;

  it("troca regioes e medidas da peca para o tamanho selecionado mantendo corpo e categoria", () => {
    const base = buildPreviewPayloadFromRecommendation(RESPONSE, product, {
      body: { height: 180, chest: 102, waist: 88, hip: 100, shoulder: 45 },
      garmentMeasurements: { chest: 111, waist: 111, shoulder: 45, length: 71 },
    });
    const state = createFitVisualizationStateForSize(RESPONSE, "L")!;
    const next = applyFitStateToPayload(base, state);
    expect(next.garment.evaluatedSize).toBe("L");
    expect(next.garment.measurements.chest).toBe(116);
    expect(next.garment.measurements.waist).toBe(116);
    // medida sem dado no motor para L nao e inventada
    expect(next.garment.measurements.shoulder).toBeNull();
    expect(next.body.chest).toBe(102);
    expect(next.garment.category).toBe("tshirt");
    expect(next.regions.map((r) => r.region)).toEqual(["chest", "waist"]);
    expect(base.garment.measurements.chest).toBe(111); // imutavel
  });

  it("estado a partir do payload preserva o payload", () => {
    const base = buildPreviewPayloadFromRecommendation(RESPONSE, product);
    const state = createFitVisualizationStateFromPayload(base);
    expect(state.source).toBe("payload");
    expect(state.fitScore).toBeNull();
    expect(applyFitStateToPayload(base, state)).toBe(base);
  });
});
