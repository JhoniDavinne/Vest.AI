import { describe, expect, it } from "vitest";
import { buildPreviewPayloadFromRecommendation } from "@veste-ai/fit-preview-3d";
import type { RecommendationResponse } from "@veste-ai/contracts";

const mockResponse = {
  evaluated_size: "M",
  regions: [
    { region: "chest", status: "good", body: 102, garment: 104, ease: 2 },
    { region: "waist", status: "attention", body: 88, garment: 90, ease: 2 },
  ],
} as unknown as RecommendationResponse;

describe("buildPreviewPayloadFromRecommendation", () => {
  it("monta payload a partir de regioes e produto", () => {
    const payload = buildPreviewPayloadFromRecommendation(mockResponse, {
      category: "tshirt",
      color: "Preto",
      modeling: "regular",
    });
    expect(payload.garment.category).toBe("tshirt");
    expect(payload.body.chest).toBe(102);
    expect(payload.regions).toHaveLength(2);
    expect(payload.disclaimer).toContain("Visualização 3D estimada");
  });
});
