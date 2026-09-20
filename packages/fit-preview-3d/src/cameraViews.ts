/**
 * Vistas predefinidas da camera (frente / lateral / costas) e zoom por passos.
 * Puro: sem dependencia de React ou do Canvas, para ser testavel.
 */
export type CameraView = "front" | "side" | "back";

export const CAMERA_VIEWS: readonly CameraView[] = ["front", "side", "back"];

/** Angulo azimutal (rad) em torno do alvo para cada vista. */
export const VIEW_AZIMUTH: Record<CameraView, number> = {
  front: 0,
  side: Math.PI / 2,
  back: Math.PI,
};

export const CAMERA_DEFAULT_POSITION: readonly [number, number, number] = [0, 0.9, 2.55];
export const CAMERA_TARGET: readonly [number, number, number] = [0, 0.62, 0];
export const CAMERA_MIN_DISTANCE = 2;
export const CAMERA_MAX_DISTANCE = 4.2;
export const ZOOM_STEP = 0.85;

export interface SphericalPose {
  radius: number;
  phi: number;
  theta: number;
}

export function clampDistance(distance: number): number {
  if (!Number.isFinite(distance)) return CAMERA_MAX_DISTANCE;
  return Math.min(CAMERA_MAX_DISTANCE, Math.max(CAMERA_MIN_DISTANCE, distance));
}

/** Nova distancia apos um passo de zoom (+1 aproxima, -1 afasta). */
export function stepDistance(current: number, direction: 1 | -1): number {
  const factor = direction === 1 ? ZOOM_STEP : 1 / ZOOM_STEP;
  return clampDistance(current * factor);
}

/** Pose esferica inicial derivada da posicao padrao e do alvo. */
export function defaultSphericalPose(): SphericalPose {
  const dx = CAMERA_DEFAULT_POSITION[0] - CAMERA_TARGET[0];
  const dy = CAMERA_DEFAULT_POSITION[1] - CAMERA_TARGET[1];
  const dz = CAMERA_DEFAULT_POSITION[2] - CAMERA_TARGET[2];
  const radius = Math.sqrt(dx * dx + dy * dy + dz * dz);
  return {
    radius,
    phi: Math.acos(Math.min(1, Math.max(-1, dy / radius))),
    theta: Math.atan2(dx, dz),
  };
}

/** Converte pose esferica em posicao cartesiana relativa ao alvo. */
export function sphericalToPosition(pose: SphericalPose): [number, number, number] {
  const sinPhiRadius = Math.sin(pose.phi) * pose.radius;
  return [
    CAMERA_TARGET[0] + sinPhiRadius * Math.sin(pose.theta),
    CAMERA_TARGET[1] + Math.cos(pose.phi) * pose.radius,
    CAMERA_TARGET[2] + sinPhiRadius * Math.cos(pose.theta),
  ];
}

/** Pose para uma vista nomeada mantendo raio/elevacao atuais. */
export function poseForView(view: CameraView, current: SphericalPose): SphericalPose {
  return { ...current, theta: VIEW_AZIMUTH[view] };
}
