import { describe, expect, it } from "vitest";
import type { RecommendationResponse } from "@veste-ai/contracts";
import { resolvePreviewSelection } from "./fit-preview";

const region = (garment: number, status = "good") => ({
  region: "chest",
  status,
  label: "",
  body: 102,
  garment,
  ease: garment - 102,
  design_ease: 10,
  deviation: garment - 112,
  score: 0.9,
  note: "",
});

const base = {
  evaluated_size: "M",
  evaluated_sku: "SKU-M",
  recommended_size: "M",
  recommended_sku: "SKU-M",
  fit_score: 8.7,
  confidence: "medium",
  regions: [region(111)],
  comparison: [
    { sku: "SKU-S", size: "S", fit_score: 6, recommended: false, components: {}, regional_analysis: {}, regions: [region(106, "ease_recommended")] },
    { sku: "SKU-M", size: "M", fit_score: 8.7, recommended: true, components: {}, regional_analysis: {}, regions: [region(111)] },
    { sku: "SKU-L", size: "L", fit_score: 7.4, recommended: false, components: {}, regional_analysis: {}, regions: [region(116, "attention")] },
    { sku: "SKU-XL", size: "XL", fit_score: 5, recommended: false, components: {}, regional_analysis: {} },
  ],
} as unknown as RecommendationResponse;

describe("resolvePreviewSelection", () => {
  it("sem selecao usa o tamanho avaliado e marca recomendado", () => {
    const sel = resolvePreviewSelection(base, null);
    expect(sel.selectedPreviewSize).toBe("M");
    expect(sel.isRecommended).toBe(true);
    expect(sel.fit?.fitScore).toBe(8.7);
    expect(sel.needsEngineFetch).toBe(false);
  });

  it("troca M -> L usando comparison do motor, sem HTTP, mantendo recomendado = M", () => {
    const sel = resolvePreviewSelection(base, "L");
    expect(sel.recommendedSize).toBe("M");
    expect(sel.selectedPreviewSize).toBe("L");
    expect(sel.isRecommended).toBe(false);
    expect(sel.fit?.fitScore).toBe(7.4);
    expect(sel.fit?.regions.chest?.garment).toBe(116);
    expect(sel.fit?.regions.chest?.status).toBe("attention");
    expect(sel.needsEngineFetch).toBe(false);
  });

  it("comparison incompleto exige consulta ao motor; resposta detalhada resolve", () => {
    expect(resolvePreviewSelection(base, "XL").needsEngineFetch).toBe(true);
    const detail = { ...base, evaluated_size: "XL", evaluated_sku: "SKU-XL", fit_score: 5, regions: [region(121, "attention")] } as RecommendationResponse;
    const sel = resolvePreviewSelection(base, "XL", { XL: detail });
    expect(sel.needsEngineFetch).toBe(false);
    expect(sel.fit?.source).toBe("response");
    expect(sel.fit?.fitScore).toBe(5);
    expect(sel.fit?.regions.chest?.garment).toBe(121);
  });

  it("voltar ao recomendado restaura o estado original", () => {
    const back = resolvePreviewSelection(base, base.recommended_size);
    expect(back.isRecommended).toBe(true);
    expect(back.fit?.source).toBe("response");
  });
});
