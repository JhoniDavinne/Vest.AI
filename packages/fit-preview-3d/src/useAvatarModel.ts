"use client";

import * as React from "react";
import { useGLTF } from "@react-three/drei";
import { Group, type Object3D } from "three";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import {
  applyMorphState,
  computeAvatarMorphState,
  mergeMorphMapping,
  type AvatarMorphState,
  type MorphAxis,
  type MorphTargetMapping,
} from "./avatarMorph";
import { forEachMesh, hasMorphTargets, measureObject, metricCorrectionFactor, placeMetricObject } from "./modelUtils";
import type { BodyScaleFactors } from "./types";

export interface AvatarModel {
  /** Instancia propria (clonada do cache do useGLTF) pronta para a cena. */
  object: Object3D;
  /** Estado morph calculado a partir dos fatores corporais. */
  morphState: AvatarMorphState;
  /** Eixos efetivamente aplicados via morph targets. */
  appliedAxes: MorphAxis[];
  /** `true` quando o GLB nao possui morph targets (avatar rigido). */
  rigid: boolean;
}

/**
 * Carrega o avatar GLB (suspende via `useGLTF`), clona a cena cacheada,
 * aplica escala metrica e escreve os morph targets a partir de `factors`.
 *
 * O mesmo GLB nunca e baixado duas vezes: `useGLTF` mantem cache global por URL.
 * O clone evita que duas instancias na pagina (ex.: catalogo + resultado)
 * compartilhem `morphTargetInfluences`.
 */
export function useAvatarModel(
  url: string,
  factors: BodyScaleFactors,
  morphMapping?: Partial<MorphTargetMapping> | null,
): AvatarModel {
  const gltf = useGLTF(url);

  const object = React.useMemo(() => {
    const instance = cloneSkeleton(gltf.scene) as Group;
    const bounds = measureObject(instance);
    const correction = metricCorrectionFactor(bounds.height);
    if (correction !== 1) instance.scale.multiplyScalar(correction);
    // Garante pes na origem antes da conversao metrica.
    const measured = measureObject(instance);
    instance.position.y -= measured.minY;
    instance.updateMatrixWorld(true);

    const root = placeMetricObject(new Group());
    root.add(instance);
    forEachMesh(instance, (mesh) => {
      mesh.castShadow = false;
      mesh.receiveShadow = false;
    });
    return root;
  }, [gltf.scene]);

  const mapping = React.useMemo(() => mergeMorphMapping(morphMapping), [morphMapping]);
  const morphState = React.useMemo(() => computeAvatarMorphState(factors), [factors]);

  const appliedAxes = React.useMemo(() => {
    const applied = new Set<MorphAxis>();
    forEachMesh(object, (mesh) => {
      const result = applyMorphState(mesh, morphState, mapping);
      result.applied.forEach((axis) => applied.add(axis));
    });
    return Array.from(applied);
  }, [object, morphState, mapping]);

  const rigid = React.useMemo(() => !hasMorphTargets(object), [object]);

  return { object, morphState, appliedAxes, rigid };
}
