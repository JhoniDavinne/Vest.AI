"use client";

import * as React from "react";
import type { FitPreviewPayload } from "./types";
import { computeBodyScale, garmentScale, parseGarmentColor } from "./scaleBody";
import { REGION_BAND_Y } from "./silhouette";

interface GarmentPrimitiveProps {
  payload: FitPreviewPayload;
}

/**
 * Representacao simplificada da peca (primitivas) — fallback quando o GLB da
 * categoria nao existe, e placeholder, ou falha ao carregar.
 * Mantida da v1 do provador; nao pretende precisao fisica.
 */
export function GarmentPrimitive({ payload }: GarmentPrimitiveProps) {
  const color = parseGarmentColor(payload.garment.color);
  const [sx, sy] = garmentScale(payload);
  const factors = React.useMemo(() => computeBodyScale(payload), [payload]);
  const category = payload.garment.category;
  const isBottom = category === "pants" || category === "shorts";
  const isDress = category === "dress";

  const garmentMat = {
    color,
    roughness: 0.55,
    metalness: 0.04,
    transparent: true,
    opacity: 0.82,
  };

  if (isBottom) {
    const legSpread = 0.085;
    const legScaleY = 0.55 * sy;
    return (
      <group name={`garment-${category}`} scale={[1, factors.height, 1]}>
        <mesh position={[-legSpread, 0.36, 0.05]} scale={[0.85 * sx, legScaleY, 0.22]}>
          <boxGeometry args={[0.16, 0.72, 0.12]} />
          <meshStandardMaterial {...garmentMat} />
        </mesh>
        <mesh position={[legSpread, 0.36, 0.05]} scale={[0.85 * sx, legScaleY, 0.22]}>
          <boxGeometry args={[0.16, 0.72, 0.12]} />
          <meshStandardMaterial {...garmentMat} />
        </mesh>
      </group>
    );
  }

  const torsoCenterY = isDress ? (REGION_BAND_Y.chest + REGION_BAND_Y.hip) / 2 : REGION_BAND_Y.chest - 0.04;
  const torsoHeight = isDress
    ? REGION_BAND_Y.chest - REGION_BAND_Y.hip + 0.42 * sy
    : 0.34 * sy + 0.12;
  const torsoWidth = Math.min(0.52, 0.36 + sx * 0.06);

  return (
    <group name={`garment-${category}`} scale={[1, factors.height, 1]}>
      <mesh position={[0, torsoCenterY, 0.05]} scale={[torsoWidth, torsoHeight, 0.14]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial {...garmentMat} />
      </mesh>
      {isDress ? (
        <mesh
          position={[0, (REGION_BAND_Y.hip + REGION_BAND_Y.length) / 2, 0.05]}
          scale={[torsoWidth * 0.92, (REGION_BAND_Y.hip - REGION_BAND_Y.length) * 0.85, 0.12]}
        >
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial {...garmentMat} opacity={0.78} />
        </mesh>
      ) : null}
    </group>
  );
}
