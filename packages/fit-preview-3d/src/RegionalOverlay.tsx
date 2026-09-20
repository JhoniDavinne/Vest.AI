"use client";

import * as React from "react";
import type { FitPreviewPayload } from "./types";
import { STATUS_COLOR_HEX } from "./constants";
import { REGION_BAND_RADIUS, REGION_BAND_Y, STATUS_BAND_OPACITY } from "./silhouette";
import { computeBodyScale, regionRadiusScale } from "./scaleBody";

interface RegionalOverlayProps {
  payload: FitPreviewPayload;
}

/** Faixas horizontais de medida — mesmo conceito do guia "Como medir". */
export function RegionalOverlay({ payload }: RegionalOverlayProps) {
  const factors = React.useMemo(() => computeBodyScale(payload), [payload]);

  return (
    <group name="regional-overlay" scale={[1, factors.height, 1]}>
      {payload.regions.map((region) => {
        const y = REGION_BAND_Y[region.region];
        const baseRadius = REGION_BAND_RADIUS[region.region];
        if (y == null || baseRadius == null) return null;

        let factor = 1;
        if (region.region === "shoulder") factor = factors.shoulder;
        if (region.region === "chest") factor = factors.chest;
        if (region.region === "waist") factor = factors.waist;
        if (region.region === "hip") factor = factors.hip;
        const radius = regionRadiusScale(baseRadius, factor);

        const color = STATUS_COLOR_HEX[region.status] ?? STATUS_COLOR_HEX.not_evaluated;
        const opacity = STATUS_BAND_OPACITY[region.status] ?? 0.3;

        return (
          <mesh
            key={region.region}
            position={[0, y, 0.16]}
            rotation={[Math.PI / 2, 0, 0]}
            name={`band-${region.region}`}
          >
            <torusGeometry args={[radius, 0.005, 6, 28]} />
            <meshStandardMaterial
              color={color}
              transparent
              opacity={opacity}
              emissive={color}
              emissiveIntensity={region.status === "good" ? 0.08 : 0.22}
              depthWrite={false}
            />
          </mesh>
        );
      })}
    </group>
  );
}
