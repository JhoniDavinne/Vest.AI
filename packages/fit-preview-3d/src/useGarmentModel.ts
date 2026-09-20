"use client";

import * as React from "react";
import { useGLTF } from "@react-three/drei";
import { DoubleSide, Group, Material, MeshStandardMaterial, type Object3D } from "three";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { GarmentVisualState } from "./garmentVisual";
import {
  disposeMaterials,
  forEachMesh,
  hasAlbedoMap,
  measureObject,
  metricCorrectionFactor,
  placeMetricObject,
} from "./modelUtils";

export interface GarmentModel {
  object: Object3D;
}

/**
 * Carrega a peca GLB por URL (resolvida pelo manifest), clona a cena cacheada
 * e aplica escala metrica. Materiais PBR com textura sao preservados (clone
 * proprio); malhas sem mapa recebem tecido fosco derivado do payload.
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
    root.name = "garment-root";
    root.add(instance);
    return root;
  }, [gltf.scene]);

  React.useEffect(() => {
    disposeMaterials(materialsRef.current);
    materialsRef.current = [];
    forEachMesh(object, (mesh) => {
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.renderOrder = 1;
      const roughness = Math.min(0.9, Math.max(0.7, visual.roughness));
      if (hasAlbedoMap(mesh.material)) {
        const current = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
        const cloned = (current as MeshStandardMaterial).clone();
        cloned.transparent = false;
        cloned.opacity = 1;
        cloned.depthWrite = true;
        cloned.metalness = 0;
        cloned.roughness = roughness;
        cloned.side = DoubleSide;
        mesh.material = cloned;
        materialsRef.current.push(cloned);
        return;
      }
      const material = new MeshStandardMaterial({
        color: visual.color,
        roughness,
        metalness: 0,
        transparent: false,
        opacity: 1,
        side: DoubleSide,
      });
      mesh.material = material;
      materialsRef.current.push(material);
    });
    return () => {
      disposeMaterials(materialsRef.current);
      materialsRef.current = [];
    };
  }, [object, visual.color, visual.roughness]);

  return { object };
}

export function preloadGarmentModel(url: string): void {
  useGLTF.preload(url);
}
