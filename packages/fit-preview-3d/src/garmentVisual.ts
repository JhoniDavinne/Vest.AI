/**
 * Estado visual da peca 3D derivado do payload do motor.
 *
 *   garment.category / measurements / color / fabric / elasticity / modeling
 *        -> GarmentVisualState (cor, material, escala discreta)
 *
 * Nao e simulacao fisica: as escalas sao sugestoes visuais limitadas e o
 * caimento por regiao continua vindo exclusivamente de `regions[]` do motor.
 */
import type { Modeling } from "@veste-ai/contracts";
import type { FitPreviewPayload } from "./types";
import { clamp, parseGarmentColor } from "./scaleBody";
import { REFERENCE_BODY } from "./constants";

export interface GarmentVisualState {
  color: string;
  opacity: number;
  roughness: number;
  metalness: number;
  /** Escala visual [x, y, z] aplicada ao GLB da peca (limitada). */
  scale: [number, number, number];
  /** Rotulo curto do material inferido (para depuracao/tooltips). */
  material: "knit" | "woven" | "denim" | "smooth" | "fleece" | "unknown";
}

export const GARMENT_SCALE_MIN = 0.9;
export const GARMENT_SCALE_MAX = 1.15;

/** Folga visual por modelagem (apenas percepcao de volume, nao medida). */
export const MODELING_VOLUME: Record<Modeling, number> = {
  slim: 0.98,
  regular: 1.0,
  relaxed: 1.03,
  oversized: 1.06,
};

// Ordem importa: padroes especificos antes do generico "algodao/malha".
const FABRIC_HINTS: { pattern: RegExp; material: GarmentVisualState["material"]; roughness: number }[] = [
  { pattern: /jeans|denim|sarja|brim/i, material: "denim", roughness: 0.78 },
  { pattern: /moletom|fleece|felpa|flanela/i, material: "fleece", roughness: 0.82 },
  { pattern: /seda|cetim|satin|viscose|acetinado/i, material: "smooth", roughness: 0.32 },
  { pattern: /oxford|linho|tricoline|popeline|alfaiataria|tecido plano/i, material: "woven", roughness: 0.55 },
  { pattern: /malha|algod[aã]o|piquet|piqu[eê]|jersey|knit|tricot/i, material: "knit", roughness: 0.62 },
];

/** Atenuacao da diferenca peca/corpo na escala visual (evita sugerir precisao fisica). */
const GARMENT_EASE_DAMPING = 0.5;
const REFERENCE_GARMENT_LENGTH_CM = 70;

/**
 * Escala visual da peca relativa ao corpo do payload (ou a referencia quando a
 * medida corporal falta). A diferenca e amortecida e limitada.
 */
export function garmentBodyScale(payload: FitPreviewPayload): [number, number, number] {
  const g = payload.garment.measurements;
  const b = payload.body;
  const ratio = (garment: number | null | undefined, body: number | null | undefined, reference: number): number => {
    if (garment == null || garment <= 0) return 1;
    const base = body != null && body > 0 ? body : reference;
    return 1 + (garment / base - 1) * GARMENT_EASE_DAMPING;
  };
  const sx = ratio(g.chest, b.chest, REFERENCE_BODY.chest);
  const sz = (ratio(g.waist, b.waist, REFERENCE_BODY.waist) + sx) / 2;
  const sy = ratio(g.length, null, REFERENCE_GARMENT_LENGTH_CM);
  return [sx, sy, sz];
}

export function inferMaterial(fabric: string | undefined | null): Pick<GarmentVisualState, "material" | "roughness"> {
  const text = (fabric ?? "").trim();
  if (!text) return { material: "unknown", roughness: 0.55 };
  for (const hint of FABRIC_HINTS) {
    if (hint.pattern.test(text)) return { material: hint.material, roughness: hint.roughness };
  }
  return { material: "unknown", roughness: 0.55 };
}

export function clampGarmentScale(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return clamp(value, GARMENT_SCALE_MIN, GARMENT_SCALE_MAX);
}

export function computeGarmentVisualState(payload: FitPreviewPayload): GarmentVisualState {
  const garment = payload.garment;
  const [sx, sy, sz] = garmentBodyScale(payload);
  const volume = MODELING_VOLUME[garment.modeling] ?? 1;
  const { material, roughness: baseRoughness } = inferMaterial(garment.fabric);

  // Tecidos mais elasticos aparentam superficie ligeiramente mais fosca/relaxada.
  const elasticity = garment.elasticity_pct ?? null;
  const roughness = clamp(baseRoughness + (elasticity != null && elasticity >= 8 ? 0.06 : 0), 0.2, 0.95);

  return {
    color: parseGarmentColor(garment.color),
    opacity: 1,
    roughness,
    metalness: 0,
    scale: [clampGarmentScale(sx * volume), clampGarmentScale(sy), clampGarmentScale(sz * volume)],
    material,
  };
}
