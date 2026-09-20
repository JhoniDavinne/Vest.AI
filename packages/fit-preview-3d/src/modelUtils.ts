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
import { Box3, Material, Mesh, Object3D, Vector3 } from "three";
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
  minY: number;
  center: Vector3;
}

export function measureObject(object: Object3D): ObjectBounds {
  const box = new Box3().setFromObject(object);
  const size = new Vector3();
  const center = new Vector3();
  box.getSize(size);
  box.getCenter(center);
  return { height: size.y, minY: box.min.y, center };
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

/** Retorna `true` se algum mesh do objeto possui morph targets. */
export function hasMorphTargets(object: Object3D): boolean {
  let found = false;
  forEachMesh(object, (mesh) => {
    if (mesh.morphTargetDictionary && Object.keys(mesh.morphTargetDictionary).length > 0) found = true;
  });
  return found;
}
