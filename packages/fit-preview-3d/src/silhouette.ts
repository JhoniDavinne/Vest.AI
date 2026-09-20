import type { RegionKey } from "@veste-ai/contracts";

/** Tom da silhueta — alinhado ao `--ivory` da UI. */
export const SILHOUETTE_COLOR = "#ede6dc";
export const SILHOUETTE_STROKE = "#d8d0c4";

/** Textura compartilhada com o guia "Como medir" (apps/web/public/images). */
export const SILHOUETTE_TEXTURE = "/images/body-silhouette-alpha.png";
export const SILHOUETTE_IMAGE_ASPECT = 352 / 1024;
export const SILHOUETTE_CENTER_Y = 0.95;
export const SILHOUETTE_HEIGHT = 1.62;

export function silhouetteBandY(imageY: number, heightScale = 1): number {
  const top = (SILHOUETTE_CENTER_Y + SILHOUETTE_HEIGHT / 2) * heightScale;
  return top - (imageY / 1024) * SILHOUETTE_HEIGHT * heightScale;
}

/** Alturas das faixas de medida — alinhadas ao PNG body-silhouette. */
export const REGION_BAND_Y: Record<RegionKey, number> = {
  shoulder: silhouetteBandY(230),
  chest: silhouetteBandY(280),
  waist: silhouetteBandY(363),
  hip: silhouetteBandY(516),
  length: 0.38,
};

export const REGION_BAND_RADIUS: Record<RegionKey, number> = {
  shoulder: 0.26,
  chest: 0.24,
  waist: 0.2,
  hip: 0.22,
  length: 0.15,
};

/** Opacidade da faixa por status — sempre visivel, intensidade varia com caimento. */
export const STATUS_BAND_OPACITY: Record<string, number> = {
  good: 0.45,
  attention: 0.85,
  ease_recommended: 0.85,
  not_evaluated: 0.2,
};
