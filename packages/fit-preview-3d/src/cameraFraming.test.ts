import { describe, expect, it } from "vitest";
import {
  computeCameraFraming,
  DEFAULT_FRAME_FILL,
  FRAME_FILL_MAX,
  FRAME_FILL_MIN,
  framingBoundsFromAvatar,
  radiusForHeight,
} from "./cameraFraming";
import { regionLayoutFromBounds } from "./regionLayout";

describe("computeCameraFraming", () => {
  it("ocupa entre 75% e 82% da altura visivel", () => {
    const height = 1.62;
    const framing = computeCameraFraming({ minY: 0, height, width: 0.45 });
    expect(framing.fill).toBeGreaterThanOrEqual(FRAME_FILL_MIN);
    expect(framing.fill).toBeLessThanOrEqual(FRAME_FILL_MAX);
    const visible = 2 * framing.radius * Math.tan(((38 * Math.PI) / 180) / 2);
    expect(height / visible).toBeCloseTo(DEFAULT_FRAME_FILL, 2);
    expect(framing.target[1]).toBeGreaterThan(height * 0.4);
    expect(framing.minDistance).toBeLessThan(framing.radius);
    expect(framing.maxDistance).toBeGreaterThan(framing.radius);
    expect(framing.defaultPose.phi).toBeCloseTo(Math.PI / 2, 5);
    expect(framing.defaultPosition[1]).toBeCloseTo(framing.target[1], 5);
  });

  it("corpo mais alto exige camera mais distante", () => {
    const short = computeCameraFraming({ minY: 0, height: 1.4 });
    const tall = computeCameraFraming({ minY: 0, height: 1.9 });
    expect(tall.radius).toBeGreaterThan(short.radius);
  });

  it("ignora fill fora da faixa", () => {
    expect(radiusForHeight(1.6, 38, 0.1)).toBe(radiusForHeight(1.6, 38, FRAME_FILL_MIN));
    expect(radiusForHeight(1.6, 38, 0.99)).toBe(radiusForHeight(1.6, 38, FRAME_FILL_MAX));
  });

  it("nao afasta a camera por causa da envergadura T-pose", () => {
    const slim = computeCameraFraming({ minY: 0, height: 1.62, width: 0.4 });
    const tpose = computeCameraFraming({ minY: 0, height: 1.62, width: 3 });
    expect(tpose.radius).toBeCloseTo(slim.radius, 5);
  });
});

describe("framingBoundsFromAvatar", () => {
  it("usa so a altura do avatar — peca e overlay nao entram", () => {
    const bounds = framingBoundsFromAvatar({
      minY: 0.14,
      height: 1.7,
      width: 1.25,
      depth: 0.32,
    });
    expect(bounds).toEqual({ minY: 0.14, height: 1.7 });
    expect(bounds.width).toBeUndefined();
  });
});

describe("regionLayoutFromBounds", () => {
  it("posiciona peito acima da cintura e ombros acima do peito", () => {
    const layout = regionLayoutFromBounds({ minY: 0, height: 1.62, width: 0.5 });
    expect(layout.y.shoulder ?? 0).toBeGreaterThan(layout.y.chest ?? 0);
    expect(layout.y.chest ?? 0).toBeGreaterThan(layout.y.waist ?? 0);
    expect(layout.y.waist ?? 0).toBeGreaterThan(layout.y.hip ?? 0);
    expect(layout.radius.chest ?? 0).toBeGreaterThan(0.08);
  });

  it("nao usa a envergadura T-pose como largura do torso", () => {
    const layout = regionLayoutFromBounds({ minY: 0, height: 1.62, width: 3 });
    expect(layout.radius.shoulder ?? 99).toBeLessThan(0.4);
  });
});
