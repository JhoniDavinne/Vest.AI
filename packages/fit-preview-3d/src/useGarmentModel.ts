"use client";

import * as React from "react";
import { useGLTF } from "@react-three/drei";
import { Group, Material, MeshStandardMaterial, type Object3D } from "three";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { GarmentVisualState } from "./garmentVisual";
import { disposeMaterials, forEachMesh, measureObject, metricCorrectionFactor, placeMetricObject } from "./modelUtils";

export interface GarmentModel {
  object: Object3D;
}

/**
 * Carrega a peca GLB por URL (resolvida pelo manifest), clona a cena cacheada,
 * aplica escala metrica e substitui os materiais por um `MeshStandardMaterial`
 * proprio colorido/ajustado pelo `GarmentVisualState`.
 *
 * Os materiais criados aqui sao descartados no unmount; geometrias continuam
 * compartilhadas com o cache global do `useGLTF`.
 */
export function useGarmentModel(url: string, visual: GarmentVisualState): GarmentModel {
  const gltf = useGLTF(url);
  const materialsRef = React.useRef<Material[]>([]);

  const object = React.useMemo(() => {
    const instance = cloneSkeleton(gltf.scene) as Group;
    const bounds = measureObject(instance);
    const correction = metricCorrectionFactor(bounds.height);
    if (correction !== 1) instance.scale.multiplyScalar(correction);
    instance.updateMatrixWorld(true);

    const root = placeMetricObject(new Group());
    root.add(instance);
    return root;
  }, [gltf.scene]);

  // Materiais: um por mesh, atualizados in-place quando o estado visual muda.
  React.useEffect(() => {
    disposeMaterials(materialsRef.current);
    materialsRef.current = [];
    forEachMesh(object, (mesh) => {
      const material = new MeshStandardMaterial({
        color: visual.color,
        roughness: visual.roughness,
        metalness: visual.metalness,
        transparent: visual.opacity < 1,
        opacity: visual.opacity,
      });
      mesh.material = material;
      materialsRef.current.push(material);
    });
    return () => {
      disposeMaterials(materialsRef.current);
      materialsRef.current = [];
    };
  }, [object, visual.color, visual.roughness, visual.metalness, visual.opacity]);

  React.useEffect(() => {
    const [sx, sy, sz] = visual.scale;
    const inner = object.children[0];
    if (inner) {
      inner.scale.set(sx, sy, sz);
      inner.updateMatrixWorld(true);
    }
  }, [object, visual.scale]);

  return { object };
}
