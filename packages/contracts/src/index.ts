/**
 * @veste-ai/contracts
 *
 * Tipos TypeScript do contrato HTTP da API VESTE.AI v1.
 * Espelham os schemas Pydantic em `apps/api/app/schemas`.
 * Compartilhados entre a aplicacao web e o widget incorporavel.
 */

export type FitPreference = "tight" | "regular" | "loose";
export type Modeling = "slim" | "regular" | "relaxed" | "oversized";
export type Category =
  | "tshirt"
  | "shirt"
  | "polo"
  | "hoodie"
  | "jacket"
  | "dress"
  | "pants"
  | "shorts";
export type Confidence = "high" | "medium" | "low";
export type RegionKey = "chest" | "waist" | "hip" | "shoulder" | "length";
export type RegionStatus = "good" | "attention" | "ease_recommended" | "not_evaluated";
export type Channel = "web" | "api" | "widget";

export interface Measurements {
  height?: number | null;
  weight?: number | null;
  chest?: number | null;
  waist?: number | null;
  hip?: number | null;
  shoulder?: number | null;
}

export interface MeasurementsOut extends Measurements {
  id: string;
  created_at: string;
}

export interface UserCreate {
  name: string;
  email?: string | null;
  fit_preference: FitPreference;
  photo_consent: boolean;
  measurements: Measurements;
}

export interface PhotoAnalysis {
  id: string;
  status: "completed" | "unavailable";
  source: "mediapipe" | "heuristic" | "unavailable";
  quality: number;
  shoulder_hip_ratio: number | null;
  waist_hip_ratio: number | null;
  torso_leg_ratio: number | null;
  message: string;
  created_at: string;
}

export interface User {
  id: string;
  name: string;
  email: string | null;
  fit_preference: FitPreference;
  photo_consent: boolean;
  created_at: string;
  measurements: MeasurementsOut | null;
  photo_analysis: PhotoAnalysis | null;
}

export interface GarmentMeasurement {
  chest?: number | null;
  waist?: number | null;
  hip?: number | null;
  shoulder?: number | null;
  length?: number | null;
  sleeve?: number | null;
  width?: number | null;
}

export interface Size {
  id: string;
  sku: string;
  size_label: string;
  sort_order: number;
  stock: number;
  measurements: GarmentMeasurement;
}

export interface ProductSummary {
  id: string;
  slug: string;
  name: string;
  brand: string;
  category: Category;
  audience: string;
  description: string;
  image_url: string;
  /** Imagem flat real da peca (raster) usada pelo provador com foto. Vazio = sem suporte. */
  flat_image_url: string;
  /** Derivado no backend: ha imagem flat valida (nao reflete o estado do provider). */
  tryon_supported: boolean;
  color: string;
  price_cents: number;
  modeling: Modeling;
  fabric: string;
  composition: string;
  elasticity_pct: number;
  company_id: string | null;
  company_name: string | null;
  available_sizes: string[];
}

export interface Product extends ProductSummary {
  care: string;
  sizes: Size[];
  created_at: string;
}

export interface SizeCreate {
  size_label: string;
  sku?: string;
  stock?: number;
  measurements: GarmentMeasurement;
}

export interface ProductCreate {
  name: string;
  brand: string;
  category: Category;
  audience?: string;
  description?: string;
  image_url?: string;
  flat_image_url?: string;
  color?: string;
  price_cents?: number;
  modeling: Modeling;
  fabric?: string;
  composition?: string;
  elasticity_pct?: number;
  care?: string;
  slug?: string;
  sizes: SizeCreate[];
}

export interface RecommendationRequest {
  sku?: string;
  product_id?: string;
  size?: string;
  user_id?: string;
  customer?: Measurements;
  fit_preference?: FitPreference;
  photo_analysis_id?: string;
  use_photo?: boolean;
  channel?: Channel;
  persist?: boolean;
}

export interface RegionDetail {
  region: RegionKey;
  status: RegionStatus;
  label: string;
  body: number | null;
  garment: number | null;
  ease: number | null;
  design_ease: number | null;
  deviation: number | null;
  score: number | null;
  note: string;
}

export interface FitPreviewBodyPayload {
  height: number | null;
  chest: number | null;
  waist: number | null;
  hip: number | null;
  shoulder: number | null;
  /** Peso (kg). Apenas deformacao visual do avatar; nao entra no score. */
  weight?: number | null;
  photoRatios: {
    shoulder_hip_ratio: number | null;
    waist_hip_ratio: number | null;
    torso_leg_ratio: number | null;
  } | null;
}

export interface FitPreviewGarmentPayload {
  category: Category;
  color: string;
  modeling: Modeling;
  /** Tecido da peca (usado apenas para aparencia do material 3D). */
  fabric?: string;
  /** Elasticidade heuristica (%); apenas aparencia, o caimento vem de `regions`. */
  elasticity_pct?: number | null;
  evaluatedSize: string;
  measurements: GarmentMeasurement;
}

export interface FitPreviewPayload {
  body: FitPreviewBodyPayload;
  garment: FitPreviewGarmentPayload;
  regions: RegionDetail[];
  disclaimer: string;
}

export interface ComponentScores {
  measurements: number;
  modeling: number;
  elasticity: number;
  visual_proportion: number | null;
  preference: number;
}

export interface SizeComparison {
  sku: string;
  size: string;
  fit_score: number;
  recommended: boolean;
  components: ComponentScores;
  regional_analysis: Record<RegionKey, RegionStatus>;
  /**
   * Detalhe regional calculado pelo motor para este tamanho (mesma estrutura de
   * `RecommendationResponse.regions`). Opcional para compatibilidade com respostas antigas.
   */
  regions?: RegionDetail[];
}

export interface RecommendationResponse {
  analysis_id: string | null;
  product_id: string;
  product_name: string;
  evaluated_sku: string;
  evaluated_size: string;
  recommended_sku: string;
  recommended_size: string;
  fit_score: number;
  confidence: Confidence;
  confidence_score: number;
  confidence_message: string;
  scale_label: string;
  scale_message: string;
  regional_analysis: Partial<Record<RegionKey, RegionStatus>>;
  explanation: string;
  recommendation: string;
  components: ComponentScores;
  weights: Record<keyof ComponentScores, number>;
  regions: RegionDetail[];
  comparison: SizeComparison[];
  visual_used: boolean;
  notes: string[];
  fit_preview?: FitPreviewPayload | null;
  created_at: string;
}

export interface FeedbackCreate {
  analysis_id: string;
  fit_rating: "too_tight" | "good" | "too_loose";
  purchased_size?: string;
  followed_recommendation?: boolean;
  returned?: boolean;
  return_reason?: string;
  comment?: string;
}

export interface Feedback {
  id: string;
  fit_analysis_id: string;
  fit_rating: string;
  purchased_size: string | null;
  followed_recommendation: boolean;
  returned: boolean;
  created_at: string;
}

export interface IntegrationKey {
  id: string;
  label: string;
  key: string;
  active: boolean;
  usage_count: number;
  created_at: string;
}

export interface Company {
  id: string;
  name: string;
  slug: string;
  segment: string;
  website: string | null;
  plan: string;
  created_at: string;
}

export interface CompanyDashboard {
  company: Company;
  integration_keys: IntegrationKey[];
  products_count: number;
  skus_count: number;
  analyses_count: number;
  api_calls_count: number;
  widget_calls_count: number;
}

export interface Metrics {
  disclaimer: string;
  total_analyses: number;
  recommendation_rate: number;
  most_recommended_size: string | null;
  average_score: number;
  average_confidence: number;
  confidence_distribution: Record<string, number>;
  size_distribution: Record<string, number>;
  score_distribution: { range: string; count: number }[];
  category_distribution: { category: string; analyses: number; avg_score: number }[];
  channel_distribution: Record<string, number>;
  daily_series: { date: string; analyses: number; avg_score: number }[];
  feedback_summary: {
    total: number;
    good_fit_rate?: number;
    rating_distribution?: Record<string, number>;
    return_rate_followed?: number;
    return_rate_not_followed?: number;
  };
  return_reduction_potential: {
    baseline_return_rate?: number;
    return_rate_with_recommendation?: number;
    absolute_reduction?: number;
    relative_reduction?: number;
    note?: string;
  };
}

export interface EngineComponentInfo {
  key: keyof ComponentScores;
  label: string;
  weight: number;
  description: string;
}

export interface EngineConfigResponse {
  formula: string;
  components: EngineComponentInfo[];
  parameters: Record<string, unknown>;
}

/** Provador com foto (virtual try-on, experimental). Espelha `apps/api/app/schemas` (TryOn*). */
export type TryOnStatus = "queued" | "processing" | "completed" | "failed" | "expired";

export interface TryOnAvailability {
  enabled: boolean;
  provider: string;
  available: boolean;
}

export interface TryOnJob {
  job_id: string;
  status: TryOnStatus;
  analysis_id: string;
  product_id: string;
  sku: string;
  size: string;
  /** Tamanho recomendado pelo motor — nunca alterado pelo provider de imagem. */
  recommended_size: string;
  provider: string;
  cached: boolean;
  /** Rota da API (proxy) que entrega a imagem; null enquanto nao `completed`. */
  image_url: string | null;
  duration_ms: number | null;
  error_code: string | null;
  created_at: string;
  expires_at: string | null;
  disclaimer: string;
  size_note: string;
}

/** Codigos estaveis de erro do try-on devolvidos pela API em `{ detail, code }`. */
export type TryOnErrorCode =
  | "tryon_disabled"
  | "consent_required"
  | "invalid_size"
  | "flat_image_unavailable"
  | "invalid_photo"
  | "photo_too_large"
  | "unsupported_photo_type"
  | "provider_error"
  | "provider_unavailable"
  | "provider_busy"
  | "provider_timeout"
  | "provider_out_of_memory"
  | "provider_rejected_input"
  | "result_not_found"
  | "result_expired";

export interface HealthResponse {
  status: string;
  app: string;
  environment: string;
  database: "sqlite" | "postgresql";
  products: number;
  analyses: number;
  vision: { enabled: boolean; mediapipe: boolean; mode: string; note: string };
  tryon: TryOnAvailability;
}

/** Rotulos em portugues usados na interface. */
export const FIT_PREFERENCE_LABEL: Record<FitPreference, string> = {
  tight: "Justo",
  regular: "Regular",
  loose: "Solto",
};

export const MODELING_LABEL: Record<Modeling, string> = {
  slim: "Slim",
  regular: "Regular",
  relaxed: "Relaxed",
  oversized: "Oversized",
};

export const CATEGORY_LABEL: Record<Category, string> = {
  tshirt: "Camiseta",
  shirt: "Camisa",
  polo: "Polo",
  hoodie: "Moletom",
  jacket: "Jaqueta",
  dress: "Vestido",
  pants: "Calça",
  shorts: "Shorts",
};

export const REGION_LABEL: Record<RegionKey, string> = {
  chest: "Peito",
  waist: "Cintura",
  hip: "Quadril",
  shoulder: "Ombros",
  length: "Comprimento",
};

export const REGION_STATUS_LABEL: Record<RegionStatus, string> = {
  good: "Compatível",
  attention: "Atenção",
  ease_recommended: "Folga recomendada",
  not_evaluated: "Não avaliado",
};

export const CONFIDENCE_LABEL: Record<Confidence, string> = {
  high: "Alta",
  medium: "Média",
  low: "Baixa",
};

export const API_V1_PREFIX = "/api/v1";
