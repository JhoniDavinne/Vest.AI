export const FIT_PREVIEW_DISCLAIMER_SILHOUETTE =
  "Silhueta estilizada com faixas de caimento estimadas. Não substitui prova física da peça nem representa o seu corpo.";

export const FIT_PREVIEW_DISCLAIMER_REAL =
  "Visualização 3D estimada com base nas medidas informadas. Não substitui a prova física da peça.";

/** Texto padrao do payload (avatar real). O componente escolhe pelo renderer ativo. */
export const FIT_PREVIEW_DISCLAIMER = FIT_PREVIEW_DISCLAIMER_REAL;

export type PreviewRendererKind = "human" | "silhouette";

export function resolvePreviewDisclaimer(renderer: PreviewRendererKind): string {
  return renderer === "human" ? FIT_PREVIEW_DISCLAIMER_REAL : FIT_PREVIEW_DISCLAIMER_SILHOUETTE;
}

/** Cores alinhadas ao RegionGrid da aplicacao web. */
export const STATUS_COLOR_HEX: Record<string, string> = {
  good: "#6B8F71",
  attention: "#C9A227",
  ease_recommended: "#B56A4A",
  not_evaluated: "#8A8F98",
};

/** Escala visual por status (deformacao leve por regiao). */
export const STATUS_SCALE: Record<string, number> = {
  good: 1,
  attention: 0.985,
  ease_recommended: 1.04,
  not_evaluated: 1,
};

/** Medidas de referencia (perfil demo) para normalizar o avatar. */
export const REFERENCE_BODY = {
  height: 175,
  chest: 96,
  waist: 82,
  hip: 98,
  shoulder: 44,
  weight: 72,
} as const;

export const REGION_NODE: Record<string, string> = {
  chest: "Chest",
  waist: "Waist",
  hip: "Hip",
  shoulder: "Shoulder",
  length: "Length",
};

export const DEFAULT_MODELS_BASE = "/models";
