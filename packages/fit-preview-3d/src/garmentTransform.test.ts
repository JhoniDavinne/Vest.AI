import { describe, expect, it } from "vitest";
import type { FitPreviewPayload } from "@veste-ai/contracts";
import { computeAvatarDeformationProfile } from "./avatarDeformation";
import {
  computeGarmentTransformProfile,
  GARMENT_TRANSFORM_LIMITS,
  profilesDifferVisually,
  regionFitScale,
  sizeVisualScale,
} from "./garmentTransform";

const BASE_AVATAR = computeAvatarDeformationProfile({
  height: 175,
  chest: 96,
  waist: 82,
  hip: 98,
  shoulder: 44,
});

function payload(overrides: {
  size?: string;
  regions?: FitPreviewPayload["regions"];
  length?: number;
} = {}): FitPreviewPayload {
  return {
    body: { height: 175, chest: 96, waist: 82, hip: 98, shoulder: 44, photoRatios: null },
    garment: {
      category: "tshirt",
      color: "Off-white",
      modeling: "regular",
      evaluatedSize: overrides.size ?? "M",
      measurements: { chest: 111, waist: 111, hip: 107, shoulder: 45, length: overrides.length ?? 71 },
    },
    regions: overrides.regions ?? [],
    disclaimer: "",
  };
}

describe("sizeVisualScale", () => {
  it("S < M < L < XL, com M como baseline", () => {
    expect(sizeVisualScale("S")).toBe(0.96);
    expect(sizeVisualScale("M")).toBe(1);
    expect(sizeVisualScale("L")).toBe(1.04);
    expect(sizeVisualScale("XL")).toBe(1.08);
    expect(sizeVisualScale("S")).toBeLessThan(sizeVisualScale("M"));
    expect(sizeVisualScale("L")).toBeGreaterThan(sizeVisualScale("M"));
    expect(sizeVisualScale("XL")).toBeGreaterThan(sizeVisualScale("L"));
    expect(sizeVisualScale("s")).toBe(sizeVisualScale("S"));
    expect(sizeVisualScale("?")).toBe(1);
  });
});

describe("regionFitScale", () => {
  it("mapeia tight/regular/loose sem recalcular o motor", () => {
    expect(regionFitScale({ deviation: -2 })).toBe(0.98);
    expect(regionFitScale({ deviation: 0 })).toBe(1);
    expect(regionFitScale({ deviation: 3 })).toBe(1.022);
    expect(regionFitScale({ deviation: null })).toBe(1);
    expect(regionFitScale(null)).toBe(1);
  });
});

describe("computeGarmentTransformProfile", () => {
  it("respeita limites de escala", () => {
    const huge = computeGarmentTransformProfile(payload({ size: "XXXL" }), {
      ...BASE_AVATAR,
      chestScale: 1.3,
      heightScale: 1.3,
      shoulderScale: 1.3,
    });
    expect(huge.scaleX).toBeLessThanOrEqual(GARMENT_TRANSFORM_LIMITS.max);
    expect(huge.scaleY).toBeLessThanOrEqual(GARMENT_TRANSFORM_LIMITS.max);
    expect(huge.torsoScale).toBeLessThanOrEqual(GARMENT_TRANSFORM_LIMITS.max);
  });

  it("S/M/L/XL produzem pecas visivelmente diferentes", () => {
    const s = computeGarmentTransformProfile(payload({ size: "S" }), BASE_AVATAR);
    const m = computeGarmentTransformProfile(payload({ size: "M" }), BASE_AVATAR);
    const l = computeGarmentTransformProfile(payload({ size: "L" }), BASE_AVATAR);
    const xl = computeGarmentTransformProfile(payload({ size: "XL" }), BASE_AVATAR);
    expect(s.torsoScale).toBeLessThan(m.torsoScale);
    expect(m.torsoScale).toBeLessThan(l.torsoScale);
    expect(l.torsoScale).toBeLessThan(xl.torsoScale);
    expect(profilesDifferVisually(s, xl)).toBe(true);
  });

  it("regiao tight aproxima a peca e loose aumenta volume, sem alterar o payload do motor", () => {
    const tight = computeGarmentTransformProfile(
      payload({
        regions: [{ region: "chest", status: "attention", body: 96, garment: 90, ease: 2, design_ease: 2, deviation: -4, score: 0.6, note: "", label: "" }],
      }),
      BASE_AVATAR,
    );
    const loose = computeGarmentTransformProfile(
      payload({
        regions: [{ region: "chest", status: "attention", body: 96, garment: 112, ease: 2, design_ease: 2, deviation: 8, score: 0.6, note: "", label: "" }],
      }),
      BASE_AVATAR,
    );
    expect(tight.torsoScale).toBeLessThan(loose.torsoScale);
    const raw = payload({ size: "M" });
    computeGarmentTransformProfile(raw, BASE_AVATAR);
    expect(raw.garment.evaluatedSize).toBe("M");
    expect(raw.regions).toEqual([]);
  });

  it("acompanha a deformacao visual do avatar (nao o fit_score)", () => {
    const slim = computeAvatarDeformationProfile({ height: 165, chest: 86, waist: 70, hips: 92, shoulders: 40 });
    const broad = computeAvatarDeformationProfile({ height: 185, chest: 112, waist: 100, hips: 110, shoulders: 50 });
    const a = computeGarmentTransformProfile(payload(), slim);
    const b = computeGarmentTransformProfile(payload(), broad);
    expect(b.torsoScale).toBeGreaterThan(a.torsoScale);
    expect(b.shoulderScale).toBeGreaterThan(a.shoulderScale);
  });
});
