"use client";

import * as React from "react";
import { useGLTF } from "@react-three/drei";
import { Group, MeshStandardMaterial, Vector3, type Object3D } from "three";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import {
  applyAvatarDeformation,
  detectAdapterKind,
} from "./avatarAdapters";
import type { AdapterKind, AvatarDeformationProfile } from "./avatarDeformation";
import type { MorphAxis, MorphTargetMapping } from "./avatarMorph";
import {
  disposeMaterials,
  forEachMesh,
  measureObject,
  metricCorrectionFactor,
  placeMetricObject,
  orientTPoseToCamera,
} from "./modelUtils";
import type { BodyScaleFactors } from "./types";

const SKIN_COLOR = "#c4a07a";

export interface AvatarModel {
  /** Instancia propria (clonada do cache do useGLTF) pronta para a cena. */
  object: Object3D;
  /** Eixos efetivamente aplicados via morph targets (vazio no adapter de ossos). */
  appliedAxes: MorphAxis[];
  /** Adapter escolhido automaticamente para este GLB. */
  adapter: AdapterKind;
  /** `true` quando nao ha morph targets. */
  rigid: boolean;
}

/**
 * Carrega o avatar GLB (suspende via `useGLTF`), clona a cena cacheada,
 * aplica escala metrica e deforma via morph / skeleton / regional.
 *
 * O mesmo GLB nunca e baixado duas vezes: `useGLTF` mantem cache global por URL.
 * O clone evita mutar o cache e compartilhar morphTargetInfluences / bone scales.
 */
export function useAvatarModel(
  url: string,
  factors: BodyScaleFactors,
  profile: AvatarDeformationProfile,
  morphMapping?: Partial<MorphTargetMapping> | null,
): AvatarModel {
  const gltf = useGLTF(url);
  const restScales = React.useRef(new Map<Object3D, Vector3>());
  const ownedMaterials = React.useRef<MeshStandardMaterial[]>([]);

  const object = React.useMemo(() => {
    restScales.current = new Map();
    disposeMaterials(ownedMaterials.current);
    ownedMaterials.current = [];

    const instance = cloneSkeleton(gltf.scene) as Group;
    const bounds = measureObject(instance);
    const correction = metricCorrectionFactor(bounds.height);
    if (correction !== 1) instance.scale.multiplyScalar(correction);
    instance.updateMatrixWorld(true);
    const measured = measureObject(instance);
    instance.position.y -= measured.minY;
    instance.updateMatrixWorld(true);
    orientTPoseToCamera(instance);

    const root = placeMetricObject(new Group());
    root.add(instance);
    forEachMesh(instance, (mesh) => {
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      const material = new MeshStandardMaterial({
        color: SKIN_COLOR,
        roughness: 0.72,
        metalness: 0.02,
      });
      mesh.material = material;
      ownedMaterials.current.push(material);
    });
    return root;
  }, [gltf.scene]);

  const adapter = React.useMemo(() => detectAdapterKind(object), [object]);

  const appliedAxes = React.useMemo(() => {
    const result = applyAvatarDeformation(object, adapter, profile, factors, restScales.current, morphMapping);
    object.updateMatrixWorld(true);
    return result.appliedAxes;
  }, [object, adapter, profile, factors, morphMapping]);

  React.useEffect(
    () => () => {
      disposeMaterials(ownedMaterials.current);
      ownedMaterials.current = [];
    },
    [object],
  );

  return { object, appliedAxes, adapter, rigid: adapter !== "morph" };
}

export function preloadAvatarModel(url: string): void {
  useGLTF.preload(url);
}
