import { describe, expect, it } from "vitest";
import type { FitPreviewPayload } from "@veste-ai/contracts";
import { computeBodyScale, torsoWidthScale } from "./scaleBody";

function payload(overrides: Partial<FitPreviewPayload["body"]> = {}): FitPreviewPayload {
  return {
    body: {
      height: 180,
      chest: 102,
      waist: 88,
      hip: 100,
      shoulder: 45,
      photoRatios: null,
      ...overrides,
    },
    garment: {
      category: "tshirt",
      color: "Preto",
      modeling: "oversized",
      evaluatedSize: "L",
      measurements: { chest: 130, waist: 130, hip: 128, shoulder: 53.5, length: 78 },
    },
    regions: [],
    disclaimer: "",
  };
}

describe("computeBodyScale", () => {
  it("mantem fatores dentro de limites seguros com ratios extremos de foto", () => {
    const factors = computeBodyScale(
      payload({
        photoRatios: {
          shoulder_hip_ratio: 6,
          waist_hip_ratio: 0.2,
          torso_leg_ratio: 4,
        },
      }),
    );

    expect(factors.chest).toBeLessThanOrEqual(1.22);
    expect(factors.shoulder).toBeLessThanOrEqual(1.22);
    expect(factors.waist).toBeLessThanOrEqual(1.22);
    expect(factors.height).toBeLessThanOrEqual(1.22);
  });

  it("evita largura de tronco exagerada mesmo com medidas altas", () => {
    const factors = computeBodyScale(
      payload({
        chest: 130,
        shoulder: 53.5,
      }),
    );
    const width = torsoWidthScale(factors, 1.04);

    expect(width).toBeLessThanOrEqual(1.22);
    expect(width).toBeGreaterThan(0.9);
  });
});
