/**
 * Rotulos e intensidade visual por regiao, derivados EXCLUSIVAMENTE de
 * `status`, `deviation` e `score` ja retornados pelo motor.
 *
 * Nao ha formula de caimento aqui: `status` vem do motor (`RegionStatus`);
 * o sinal de `deviation` apenas distingue "mais ajustado" de "mais folgado"
 * dentro do status `attention` — exatamente a distincao que o proprio motor
 * faz ao redigir `note` (ver engine/components/measurements.py::_classify).
 */
import type { RegionStatus } from "@veste-ai/contracts";
import { REGION_LABEL, REGION_STATUS_LABEL } from "@veste-ai/contracts";
import type { FitRegionKey, FitRegionVisual } from "./fitVisualization";

/** Direcao do desvio: sinal de `deviation` (peca − corpo − folga prevista). */
export type FitDirection = "tight" | "loose" | "neutral" | "unknown";

export function fitDirection(region: Pick<FitRegionVisual, "deviation">): FitDirection {
  const d = region.deviation;
  if (d == null || !Number.isFinite(d)) return "unknown";
  if (d < 0) return "tight";
  if (d > 0) return "loose";
  return "neutral";
}

export const REGION_LABEL_PT: Record<FitRegionKey, string> = {
  ...REGION_LABEL,
  sleeve: "Manga",
};

/**
 * Descricao curta legivel: "Compatível", "Mais ajustado", "Levemente mais folgado"…
 * Baseada no `status` do motor; `deviation` so refina o texto de `attention`.
 */
export function describeRegionFit(region: Pick<FitRegionVisual, "status" | "deviation">): string {
  switch (region.status) {
    case "good":
      return REGION_STATUS_LABEL.good;
    case "ease_recommended":
      return "Mais ajustado";
    case "attention": {
      const direction = fitDirection(region);
      if (direction === "tight") return "Levemente mais ajustado";
      if (direction === "loose") return "Levemente mais folgado";
      return REGION_STATUS_LABEL.attention;
    }
    case "not_evaluated":
      return REGION_STATUS_LABEL.not_evaluated;
    default: {
      const _exhaustive: never = region.status;
      return _exhaustive;
    }
  }
}

/** Linha de legenda: "Peito — Compatível". */
export function legendLine(region: Pick<FitRegionVisual, "region" | "status" | "deviation">): string {
  return `${REGION_LABEL_PT[region.region]} — ${describeRegionFit(region)}`;
}

/** Intensidade padrao por status quando o motor nao devolve `score`. */
export const STATUS_DEFAULT_INTENSITY: Record<RegionStatus, number> = {
  good: 0.15,
  attention: 0.6,
  ease_recommended: 0.85,
  not_evaluated: 0.1,
};

/**
 * Intensidade visual 0..1 (quanto maior, mais destaque no overlay).
 * Usa `1 − score` do motor quando disponivel; senao o padrao por status.
 */
export function regionIntensity(region: Pick<FitRegionVisual, "status" | "score">): number {
  if (region.status === "not_evaluated") return STATUS_DEFAULT_INTENSITY.not_evaluated;
  const score = region.score;
  if (score != null && Number.isFinite(score)) {
    return Math.min(1, Math.max(0, 1 - score));
  }
  return STATUS_DEFAULT_INTENSITY[region.status];
}
