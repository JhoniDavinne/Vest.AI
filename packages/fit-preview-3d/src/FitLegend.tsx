"use client";

import * as React from "react";
import type { RegionStatus } from "@veste-ai/contracts";
import type { FitVisualizationState } from "./fitVisualization";
import { describeRegionFit, fitDirection, REGION_LABEL_PT, regionIntensity } from "./regionLegend";
import { STATUS_COLOR_HEX } from "./constants";
import { ensureFitPreviewStyles } from "./styles";

export interface FitLegendProps {
  fit: FitVisualizationState;
  compact?: boolean;
  /** `inline`: linha compacta sob o canvas · `list`: lista "Regiao | Caimento" para paineis. */
  variant?: "inline" | "list";
  className?: string;
}

/** Glifo textual por status/direcao — status nunca depende so da cor. */
function statusGlyph(status: RegionStatus, direction: ReturnType<typeof fitDirection>): string {
  switch (status) {
    case "good":
      return "✓";
    case "ease_recommended":
      return "↓";
    case "attention":
      return direction === "loose" ? "↑" : direction === "tight" ? "↓" : "•";
    case "not_evaluated":
      return "–";
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

/**
 * Legenda acessivel do overlay regional em linguagem de vestibilidade:
 * "Peito — Compatível", "Cintura — Mais ajustado". Sem valores tecnicos.
 * Cores, glifos e rotulos derivam apenas de `status`/`deviation`/`score` do motor.
 */
export function FitLegend({ fit, compact = false, variant = "inline", className }: FitLegendProps) {
  React.useEffect(() => {
    ensureFitPreviewStyles();
  }, []);

  const regions = fit.regionList.filter((r) => r.status !== "not_evaluated");
  if (regions.length === 0) return null;

  const classes = ["vfp-root", "vfp-legend", variant === "list" ? "vfp-list" : "", compact ? "vfp-compact" : "", className ?? ""]
    .filter(Boolean)
    .join(" ");

  return (
    <ul aria-label={`Caimento por região · tamanho ${fit.size}`} data-testid="fit-legend" className={classes}>
      {regions.map((region) => {
        const color = STATUS_COLOR_HEX[region.status] ?? STATUS_COLOR_HEX.not_evaluated;
        const intensity = regionIntensity(region);
        const direction = fitDirection(region);
        const description = describeRegionFit(region);
        return (
          <li key={region.region} title={region.note || undefined}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <span
                className="vfp-legend-dot"
                aria-hidden="true"
                style={{
                  background: color,
                  opacity: 0.5 + 0.5 * intensity,
                  boxShadow: intensity > 0.5 ? `0 0 0 3px ${color}26` : undefined,
                }}
              />
              <span>{REGION_LABEL_PT[region.region]}</span>
            </span>
            <span className="vfp-legend-status" style={{ color }}>
              <span className="vfp-legend-glyph" aria-hidden="true">
                {statusGlyph(region.status, direction)}
              </span>
              {variant === "inline" ? <span style={{ color: "#2a2a2e" }}>{description}</span> : description}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
