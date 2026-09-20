/**
 * Adaptadores de deformacao visual. Descoberta automatica:
 *   morph targets → skeleton → regional mesh scale → escala global Y
 *
 * Nao acoplados a AvatarBody: recebem Object3D + AvatarDeformationProfile.
 */
import { Bone, Mesh, Object3D, Vector3 } from "three";
import {
  applyMorphState,
  computeAvatarMorphState,
  mergeMorphMapping,
  type MorphAxis,
  type MorphTargetMapping,
} from "./avatarMorph";
import {
  classifyBone,
  dampedBoneScale,
  selectAdapterKind,
  type AdapterKind,
  type AvatarDeformationProfile,
  type BoneClass,
} from "./avatarDeformation";
import { forEachMesh, hasMorphTargets } from "./modelUtils";
import type { BodyScaleFactors } from "./types";

const REGION_MESH = /^(chest|waist|hip|shoulder|pelvis|abdomen)$/i;

export interface AdapterCapabilities {
  hasMorphs: boolean;
  torsoBoneCount: number;
  namedRegionMeshes: number;
}

export function inspectAvatarCapabilities(root: Object3D): AdapterCapabilities {
  let torsoBoneCount = 0;
  let namedRegionMeshes = 0;
  root.traverse((child) => {
    const kind = classifyBone(child.name);
    if (kind === "shoulder" || kind === "chest" || kind === "waist" || kind === "hip") torsoBoneCount += 1;
    if ((child as Mesh).isMesh && REGION_MESH.test(child.name)) namedRegionMeshes += 1;
  });
  return { hasMorphs: hasMorphTargets(root), torsoBoneCount, namedRegionMeshes };
}

export function detectAdapterKind(root: Object3D): AdapterKind {
  return selectAdapterKind(inspectAvatarCapabilities(root));
}

export interface MorphTargetAdapterResult {
  appliedAxes: MorphAxis[];
}

/** MorphTargetAdapter: escreve morphTargetInfluences a partir dos fatores corporais. */
export function applyMorphTargetAdapter(
  root: Object3D,
  factors: BodyScaleFactors,
  mapping?: Partial<MorphTargetMapping> | null,
): MorphTargetAdapterResult {
  const morphState = computeAvatarMorphState(factors);
  const resolved = mergeMorphMapping(mapping);
  const applied = new Set<MorphAxis>();
  forEachMesh(root, (mesh) => {
    applyMorphState(mesh, morphState, resolved).applied.forEach((axis) => applied.add(axis));
  });
  return { appliedAxes: Array.from(applied) };
}

/**
 * SkeletonAdapter: escala ossos do torso em XZ. Cabeca/maos/pes nao sao tocados.
 * `restScales` guarda a escala original para reaplicar o perfil sem acumulo.
 */
export function applySkeletonAdapter(
  root: Object3D,
  profile: AvatarDeformationProfile,
  restScales: Map<Object3D, Vector3>,
): BoneClass[] {
  const applied = new Set<BoneClass>();
  root.traverse((child) => {
    const kind = classifyBone(child.name);
    const next = dampedBoneScale(kind, profile);
    if (!next) return;
    if (!restScales.has(child)) restScales.set(child, child.scale.clone());
    const rest = restScales.get(child);
    if (!rest) return;
    child.scale.set(rest.x * next.x, rest.y * next.y, rest.z * next.z);
    applied.add(kind);
  });
  return Array.from(applied);
}

/** RegionalScaleAdapter: meshes nomeados (fallback dos placeholders segmentados). */
export function applyRegionalScaleAdapter(
  root: Object3D,
  profile: AvatarDeformationProfile,
  restScales: Map<Object3D, Vector3>,
): string[] {
  const applied: string[] = [];
  const byName: Record<string, number> = {
    shoulder: profile.shoulderScale * profile.bodyMassScale,
    chest: profile.chestScale * profile.bodyMassScale,
    waist: profile.waistScale * profile.bodyMassScale,
    hip: profile.hipScale * profile.bodyMassScale,
    pelvis: profile.hipScale * profile.bodyMassScale,
    abdomen: profile.waistScale * profile.bodyMassScale,
  };
  root.traverse((child) => {
    if (!(child as Mesh).isMesh) return;
    const key = child.name.trim().toLowerCase();
    const xz = byName[key];
    if (xz == null) return;
    if (!restScales.has(child)) restScales.set(child, child.scale.clone());
    const rest = restScales.get(child);
    if (!rest) return;
    child.scale.set(rest.x * xz, rest.y, rest.z * xz);
    applied.push(child.name);
  });
  return applied;
}

export function applyAvatarDeformation(
  root: Object3D,
  kind: AdapterKind,
  profile: AvatarDeformationProfile,
  factors: BodyScaleFactors,
  restScales: Map<Object3D, Vector3>,
  morphMapping?: Partial<MorphTargetMapping> | null,
): { kind: AdapterKind; appliedAxes: MorphAxis[] } {
  if (kind === "morph") {
    const morph = applyMorphTargetAdapter(root, factors, morphMapping);
    return { kind, appliedAxes: morph.appliedAxes };
  }
  if (kind === "skeleton") {
    applySkeletonAdapter(root, profile, restScales);
    return { kind, appliedAxes: [] };
  }
  if (kind === "regional") {
    applyRegionalScaleAdapter(root, profile, restScales);
    return { kind, appliedAxes: [] };
  }
  return { kind, appliedAxes: [] };
}

export function isBoneNode(node: Object3D): boolean {
  return node instanceof Bone || node.type === "Bone";
}
