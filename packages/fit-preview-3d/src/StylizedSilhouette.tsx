"use client";

import * as React from "react";
import { useTexture } from "@react-three/drei";
import { DoubleSide } from "three";
import type { FitPreviewPayload } from "./types";
import { computeBodyScale } from "./scaleBody";
import {
  REGION_BAND_RADIUS,
  REGION_BAND_Y,
  SILHOUETTE_CENTER_Y,
  SILHOUETTE_HEIGHT,
  SILHOUETTE_IMAGE_ASPECT,
  SILHOUETTE_TEXTURE,
} from "./silhouette";

interface StylizedSilhouetteProps {
  payload: FitPreviewPayload;
}

export function StylizedSilhouette({ payload }: StylizedSilhouetteProps) {
  const factors = React.useMemo(() => computeBodyScale(payload), [payload]);
  const texture = useTexture(SILHOUETTE_TEXTURE);

  return (
    <group scale={[1, factors.height, 1]} name="stylized-silhouette">
      <mesh position={[0, SILHOUETTE_CENTER_Y, 0.01]} scale={[factors.height, 1, 1]} name="BodySilhouette">
        <planeGeometry args={[SILHOUETTE_HEIGHT * SILHOUETTE_IMAGE_ASPECT, SILHOUETTE_HEIGHT]} />
        <meshBasicMaterial map={texture} transparent side={DoubleSide} toneMapped={false} />
      </mesh>

      <group name="Chest" position={[0, REGION_BAND_Y.chest, 0]} visible={false} />
      <group name="Waist" position={[0, REGION_BAND_Y.waist, 0]} visible={false} />
      <group name="Shoulder" position={[0, REGION_BAND_Y.shoulder, 0]} visible={false} />
      <group name="Hip" position={[0, REGION_BAND_Y.hip, 0]} visible={false} />
      <group name="Length" position={[0, REGION_BAND_Y.length, 0]} visible={false} />
    </group>
  );
}

export { REGION_BAND_Y, REGION_BAND_RADIUS };
