/**
 * Enquadramento da camera a partir da bounding box do AVATAR.
 * O corpo deve ocupar ~75–82% da altura visivel do Canvas (padrao 80%).
 * Largura (bracos em T-pose), peca e RegionalOverlay nao entram no raio.
 */
import { CAMERA_TARGET, type SphericalPose } from "./cameraViews";

export const DEFAULT_FRAME_FILL = 0.8;
export const FRAME_FILL_MIN = 0.75;
export const FRAME_FILL_MAX = 0.82;
export const DEFAULT_FRAME_FOV_DEG = 38;

export interface FramingBounds {
  minY: number;
  height: number;
  width?: number;
}

export interface CameraFraming {
  target: [number, number, number];
  radius: number;
  minDistance: number;
  maxDistance: number;
  defaultPosition: [number, number, number];
  fill: number;
  defaultPose: SphericalPose;
}

function clampFill(fill: number): number {
  if (!Number.isFinite(fill)) return DEFAULT_FRAME_FILL;
  return Math.min(FRAME_FILL_MAX, Math.max(FRAME_FILL_MIN, fill));
}

/**
 * Distancia para que `height` ocupe `fill` da altura do frustum em `fovDeg`.
 * `visible = 2 * radius * tan(fov/2)` → `radius = height / (2 * fill * tan(fov/2))`.
 */
export function radiusForHeight(height: number, fovDeg: number, fill: number): number {
  const span = Math.max(0.2, height);
  const halfFov = ((fovDeg * Math.PI) / 180) / 2;
  const tan = Math.tan(halfFov);
  if (tan <= 0) return 2.55;
  return span / (2 * clampFill(fill) * tan);
}

/** Converte a bbox do avatar em bounds de camera (altura apenas). */
export function framingBoundsFromAvatar(bounds: {
  minY: number;
  height: number;
  width?: number;
  depth?: number;
}): FramingBounds {
  return { minY: bounds.minY, height: bounds.height };
}

export function computeCameraFraming(
  bounds: FramingBounds,
  options?: { fovDeg?: number; fill?: number },
): CameraFraming {
  const fill = clampFill(options?.fill ?? DEFAULT_FRAME_FILL);
  const fovDeg = options?.fovDeg ?? DEFAULT_FRAME_FOV_DEG;
  const height = Math.max(0.2, bounds.height);
  const minY = Number.isFinite(bounds.minY) ? bounds.minY : 0;
  const targetY = minY + height * 0.52;
  const target: [number, number, number] = [0, targetY, 0];

  // Somente altura: bracos em T-pose / peca / overlay nao afastam a camera.
  const radius = radiusForHeight(height, fovDeg, fill);
  const minDistance = radius * 0.55;
  const maxDistance = radius * 1.9;
  const phi = Math.PI / 2;
  const defaultPose: SphericalPose = { radius, phi, theta: 0 };
  const defaultPosition: [number, number, number] = [
    target[0],
    target[1],
    target[2] + radius,
  ];

  return { target, radius, minDistance, maxDistance, defaultPosition, fill, defaultPose };
}

/** Framing de fallback alinhado as constantes historicas da silhueta. */
export function defaultCameraFraming(): CameraFraming {
  return computeCameraFraming({
    minY: CAMERA_TARGET[1] - 0.62,
    height: 1.62,
  });
}
