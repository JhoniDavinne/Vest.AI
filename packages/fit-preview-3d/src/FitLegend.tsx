"use client";

import * as React from "react";
import type { FitVisualizationState } from "./fitVisualization";
import { describeRegionFit, REGION_LABEL_PT, regionIntensity } from "./regionLegend";
import { STATUS_COLOR_HEX } from "./constants";

export interface FitLegendProps {
  fit: FitVisualizationState;
  compact?: boolean;
}

/**
 * Legenda textual acessivel do overlay regional: "Peito — Compatível".
 * Cores e rotulos derivam apenas de `status`/`deviation`/`score` do motor.
 */
export function FitLegend({ fit, compact = false }: FitLegendProps) {
  const regions = fit.regionList.filter((r) => r.status !== "not_evaluated");
  if (regions.length === 0) return null;
  return (
    <ul
      aria-label={`Caimento por região · tamanho ${fit.size}`}
      data-testid="fit-legend"
      style={{
        listStyle: "none",
        margin: 0,
        padding: compact ? "6px 8px 0" : "8px 10px 0",
        display: "flex",
        flexWrap: "wrap",
        gap: compact ? "4px 10px" : "6px 14px",
        fontSize: compact ? 11 : 12,
        color: "#2a2a2e",
      }}
    >
      {regions.map((region) => {
        const color = STATUS_COLOR_HEX[region.status] ?? STATUS_COLOR_HEX.not_evaluated;
        const intensity = regionIntensity(region);
        return (
          <li key={region.region} style={{ display: "inline-flex", alignItems: "center", gap: 6 }} title={region.note || undefined}>
            <span
              aria-hidden="true"
              style={{
                width: 9,
                height: 9,
                borderRadius: "50%",
                background: color,
                opacity: 0.45 + 0.55 * intensity,
                boxShadow: intensity > 0.5 ? `0 0 0 2px ${color}33` : undefined,
              }}
            />
            <span>
              {REGION_LABEL_PT[region.region]} — <strong style={{ fontWeight: 500 }}>{describeRegionFit(region)}</strong>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
