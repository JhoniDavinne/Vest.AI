"use client";

import * as React from "react";
import type { RegionKey } from "@veste-ai/contracts";
import type { FitPreviewPayload } from "./types";
import type { FitRegionVisual } from "./fitVisualization";
import { buildRegions } from "./fitVisualization";
import { fitDirection, regionIntensity } from "./regionLegend";
import { STATUS_COLOR_HEX } from "./constants";
import { REGION_BAND_RADIUS, REGION_BAND_Y } from "./silhouette";
import { computeBodyScale, regionRadiusScale } from "./scaleBody";

interface RegionalOverlayProps {
  payload: FitPreviewPayload;
  /** Regioes ja normalizadas (FitVisualizationState.regionList). Se ausente, usa payload.regions. */
  regions?: FitRegionVisual[];
}

/** Deslocamento radial maximo (unidades de cena) que indica direcao do desvio. */
const DIRECTION_OFFSET = 0.012;
const BASE_TUBE = 0.004;
const MAX_TUBE_EXTRA = 0.014;

/**
 * Indicadores regionais em aneis ao redor do corpo.
 *
 * Tudo deriva dos dados do motor:
 *  - cor        ← `status` (RegionStatus, mesma paleta do RegionGrid);
 *  - espessura, opacidade e emissao ← intensidade = 1 − `score` (ou padrao por status);
 *  - raio       ← levemente para dentro (deviation < 0, mais ajustado) ou para fora
 *                 (deviation > 0, mais folgado) — apenas direcao, sem escala fisica.
 * Nenhuma formula de caimento e aplicada aqui.
 */
export function RegionalOverlay({ payload, regions }: RegionalOverlayProps) {
  const factors = React.useMemo(() => computeBodyScale(payload), [payload]);
  const list = React.useMemo(() => regions ?? buildRegions(payload.regions).regionList, [regions, payload.regions]);

  return (
    <group name="regional-overlay" scale={[1, factors.height, 1]}>
      {list.map((region) => {
        const key = region.region as RegionKey;
        const y = REGION_BAND_Y[key];
        const baseRadius = REGION_BAND_RADIUS[key];
        if (y == null || baseRadius == null) return null;

        let factor = 1;
        if (key === "shoulder") factor = factors.shoulder;
        if (key === "chest") factor = factors.chest;
        if (key === "waist") factor = factors.waist;
        if (key === "hip") factor = factors.hip;
        const bodyRadius = regionRadiusScale(baseRadius, factor);

        const direction = fitDirection(region);
        const offset = direction === "tight" ? -DIRECTION_OFFSET : direction === "loose" ? DIRECTION_OFFSET : 0;
        const radius = Math.max(0.05, bodyRadius + offset);

        const intensity = regionIntensity(region);
        const color = STATUS_COLOR_HEX[region.status] ?? STATUS_COLOR_HEX.not_evaluated;
        const notEvaluated = region.status === "not_evaluated";
        const tube = BASE_TUBE + MAX_TUBE_EXTRA * intensity;
        const opacity = notEvaluated ? 0.18 : 0.35 + 0.6 * intensity;
        const emissive = notEvaluated ? 0 : 0.05 + 0.45 * intensity;

        return (
          <group key={region.region} name={`band-${region.region}`} position={[0, y, 0.16]}>
            <mesh rotation={[Math.PI / 2, 0, 0]} name={`band-${region.region}-ring`}>
              <torusGeometry args={[radius, tube, 8, 40]} />
              <meshStandardMaterial
                color={color}
                transparent
                opacity={opacity}
                emissive={color}
                emissiveIntensity={emissive}
                depthWrite={false}
              />
            </mesh>
            {!notEvaluated && direction !== "unknown" && direction !== "neutral" ? (
              // Segundo anel fino na posicao neutra: mostra "para onde" a peca desvia.
              <mesh rotation={[Math.PI / 2, 0, 0]} name={`band-${region.region}-reference`}>
                <torusGeometry args={[bodyRadius, BASE_TUBE * 0.6, 6, 40]} />
                <meshStandardMaterial color={color} transparent opacity={0.22} depthWrite={false} />
              </mesh>
            ) : null}
          </group>
        );
      })}
    </group>
  );
}
