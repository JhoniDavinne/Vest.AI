import { describe, expect, it } from "vitest";
import {
  CAMERA_DEFAULT_POSITION,
  CAMERA_MAX_DISTANCE,
  CAMERA_MIN_DISTANCE,
  clampDistance,
  defaultSphericalPose,
  poseForView,
  sphericalToPosition,
  stepDistance,
  VIEW_AZIMUTH,
} from "./cameraViews";

describe("zoom", () => {
  it("aproxima e afasta respeitando os limites do OrbitControls", () => {
    expect(stepDistance(3, 1)).toBeLessThan(3);
    expect(stepDistance(3, -1)).toBeGreaterThan(3);
    expect(stepDistance(CAMERA_MIN_DISTANCE, 1)).toBe(CAMERA_MIN_DISTANCE);
    expect(stepDistance(CAMERA_MAX_DISTANCE, -1)).toBe(CAMERA_MAX_DISTANCE);
    expect(clampDistance(Number.NaN)).toBe(CAMERA_MAX_DISTANCE);
  });
});

describe("vistas predefinidas", () => {
  it("pose padrao reconstroi a posicao inicial da camera", () => {
    const [x, y, z] = sphericalToPosition(defaultSphericalPose());
    expect(x).toBeCloseTo(CAMERA_DEFAULT_POSITION[0], 5);
    expect(y).toBeCloseTo(CAMERA_DEFAULT_POSITION[1], 5);
    expect(z).toBeCloseTo(CAMERA_DEFAULT_POSITION[2], 5);
  });

  it("frente, lateral e costas trocam apenas o azimute", () => {
    const base = defaultSphericalPose();
    const side = poseForView("side", base);
    const back = poseForView("back", base);
    expect(side.radius).toBe(base.radius);
    expect(side.phi).toBe(base.phi);
    expect(side.theta).toBe(VIEW_AZIMUTH.side);
    expect(back.theta).toBe(VIEW_AZIMUTH.back);

    const [sx, , sz] = sphericalToPosition(side);
    const [bx, , bz] = sphericalToPosition(back);
    expect(sx).toBeGreaterThan(1); // lateral: camera deslocada em X
    expect(Math.abs(sz)).toBeLessThan(1e-6);
    expect(bz).toBeLessThan(0); // costas: camera atras do avatar
    expect(Math.abs(bx)).toBeLessThan(1e-6);
  });
});
