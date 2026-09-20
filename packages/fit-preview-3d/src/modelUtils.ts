/**
 * Utilitarios de cena para assets GLB em escala metrica.
 *
 * Contrato dos assets (ver docs/implementation/ETAPA_02_DIGITAL_TWIN_3D.md):
 *  - unidades em metros, eixo Y para cima, pes na origem (y = 0);
 *  - avatar e pecas compartilham o mesmo rig/escala.
 *
 * A cena existente (silhueta estilizada) trabalha em unidades proprias:
 * altura `SILHOUETTE_HEIGHT` com base em `SILHOUETTE_CENTER_Y - SILHOUETTE_HEIGHT / 2`.
 * Estas funcoes convertem metros para essas unidades, mantendo camera,
 * OrbitControls e overlays regionais inalterados.
 */
import { Box3, Material, Mesh, MeshStandardMaterial, Object3D, Vector3 } from "three";
import { REFERENCE_BODY } from "./constants";
import { SILHOUETTE_CENTER_Y, SILHOUETTE_HEIGHT } from "./silhouette";

/** Altura do corpo de referencia em metros (REFERENCE_BODY.height esta em cm). */
export const REFERENCE_HEIGHT_M = REFERENCE_BODY.height / 100;

/** Unidades de cena por metro (corpo de referencia ocupa SILHOUETTE_HEIGHT). */
export const SCENE_UNITS_PER_METER = SILHOUETTE_HEIGHT / REFERENCE_HEIGHT_M;

/** Y da base (pes) na cena. */
export const SCENE_FLOOR_Y = SILHOUETTE_CENTER_Y - SILHOUETTE_HEIGHT / 2;

export interface MetricPlacement {
  scale: number;
  positionY: number;
}

/** Escala/posicao para colocar um asset metrico sobre o "chao" da cena. */
export function metricPlacement(): MetricPlacement {
  return { scale: SCENE_UNITS_PER_METER, positionY: SCENE_FLOOR_Y };
}

/** Aplica `metricPlacement` diretamente em um Object3D. */
export function placeMetricObject(object: Object3D): Object3D {
  const { scale, positionY } = metricPlacement();
  object.scale.setScalar(scale);
  object.position.set(0, positionY, 0);
  object.updateMatrixWorld(true);
  return object;
}

export interface ObjectBounds {
  height: number;
  width: number;
  depth: number;
  minY: number;
  center: Vector3;
}

export function measureObject(object: Object3D): ObjectBounds {
  const box = new Box3().setFromObject(object);
  const size = new Vector3();
  const center = new Vector3();
  box.getSize(size);
  box.getCenter(center);
  return { height: size.y, width: size.x, depth: size.z, minY: box.min.y, center };
}

/**
 * Orienta um humanoide em T-pose para a camera em +Z.
 *
 * `avatar_base.glb` tem bracos ao longo de Z (profundidade ~1.17 m) e peito em +X
 * (~0.28 m). Sem esta rotacao a camera olha pelo eixo dos bracos e o corpo
 * aparece como uma silhueta estreita. Apos -90° em Y: bracos em X, frente em +Z.
 */
export function orientTPoseToCamera(object: Object3D): void {
  object.updateMatrixWorld(true);
  const before = measureObject(object);
  if (before.depth > before.width * 1.2) {
    object.rotation.y -= Math.PI / 2;
    object.updateMatrixWorld(true);
  }
  const after = measureObject(object);
  object.position.x -= after.center.x;
  object.position.z -= after.center.z;
  object.updateMatrixWorld(true);
}

/**
 * Heuristica para detectar assets fora do contrato metrico (ex.: exportado em cm).
 * Retorna um fator de correcao para levar a altura a ~REFERENCE_HEIGHT_M quando
 * a altura medida for absurda (> 10 m ou < 0.5 m). Caso contrario retorna 1.
 */
export function metricCorrectionFactor(heightInAssetUnits: number): number {
  if (!Number.isFinite(heightInAssetUnits) || heightInAssetUnits <= 0) return 1;
  if (heightInAssetUnits > 10 || heightInAssetUnits < 0.5) {
    return REFERENCE_HEIGHT_M / heightInAssetUnits;
  }
  return 1;
}

/** Percorre os meshes de um objeto. */
export function forEachMesh(object: Object3D, visit: (mesh: Mesh) => void): void {
  object.traverse((child) => {
    if ((child as Mesh).isMesh) visit(child as Mesh);
  });
}

/** Libera materiais criados por nos (clones). Nao toca em geometrias compartilhadas do cache. */
export function disposeMaterials(materials: Iterable<Material>): void {
  for (const material of materials) {
    material.dispose();
  }
}

/** Retorna `true` se o material tem textura de albedo (PBR valido). */
export function hasAlbedoMap(material: Material | Material[]): boolean {
  const list = Array.isArray(material) ? material : [material];
  return list.some((item) => Boolean((item as MeshStandardMaterial).map));
}

/** Retorna `true` se algum mesh do objeto possui morph targets. */
export function hasMorphTargets(object: Object3D): boolean {
  let found = false;
  forEachMesh(object, (mesh) => {
    if (mesh.morphTargetDictionary && Object.keys(mesh.morphTargetDictionary).length > 0) found = true;
  });
  return found;
}

/** Helpers de bounding box/eixos apenas em `next dev` / vitest development. */
export function isSceneDebugEnabled(): boolean {
  return process.env.NODE_ENV === "development";
}
