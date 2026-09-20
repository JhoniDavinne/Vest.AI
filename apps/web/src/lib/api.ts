/**
 * Cliente HTTP da API VESTE.AI para a aplicacao web.
 *
 * - No servidor (RSC) usa API_URL (ex.: http://api:8000 no Docker).
 * - No navegador usa NEXT_PUBLIC_API_URL (ex.: http://localhost:8000).
 * A logica de recomendacao NUNCA e replicada aqui: tudo vem do backend.
 */
import type {
  CompanyDashboard,
  EngineConfigResponse,
  Feedback,
  FeedbackCreate,
  HealthResponse,
  Measurements,
  Metrics,
  PhotoAnalysis,
  Product,
  ProductCreate,
  ProductSummary,
  RecommendationRequest,
  RecommendationResponse,
  Size,
  User,
  UserCreate,
} from "@veste-ai/contracts";
import { API_V1_PREFIX } from "@veste-ai/contracts";

export const DEMO_API_KEY = process.env.NEXT_PUBLIC_DEMO_API_KEY ?? "veste_demo_key_loja_parceira";

export function apiBaseUrl(): string {
  if (typeof window === "undefined") {
    return (process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "");
  }
  return (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "");
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}, options: { apiKey?: string } = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (!(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (options.apiKey) headers.set("X-API-Key", options.apiKey);

  const response = await fetch(`${apiBaseUrl()}${API_V1_PREFIX}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });
  if (!response.ok) {
    let detail = `Erro ${response.status}`;
    try {
      const body = (await response.json()) as { detail?: unknown };
      if (typeof body.detail === "string") detail = body.detail;
      else if (Array.isArray(body.detail)) {
        detail = body.detail
          .map((d: { msg?: string; loc?: unknown[] }) => `${(d.loc ?? []).slice(-1)[0] ?? ""}: ${d.msg ?? ""}`)
          .join("; ");
      }
    } catch {
      /* corpo nao-JSON */
    }
    throw new ApiError(detail, response.status);
  }
  return (await response.json()) as T;
}

export const api = {
  health: () => request<HealthResponse>("/health"),

  // Catalogo
  listProducts: (category?: string) =>
    request<ProductSummary[]>(`/products${category ? `?category=${encodeURIComponent(category)}` : ""}`),
  getProduct: (idOrSlug: string) => request<Product>(`/products/${encodeURIComponent(idOrSlug)}`),
  getSizes: (idOrSlug: string) => request<Size[]>(`/products/${encodeURIComponent(idOrSlug)}/sizes`),
  createProduct: (payload: ProductCreate, apiKey?: string) =>
    request<Product>("/products", { method: "POST", body: JSON.stringify(payload) }, { apiKey }),

  // Consumidor
  createUser: (payload: UserCreate) => request<User>("/users", { method: "POST", body: JSON.stringify(payload) }),
  getUser: (id: string) => request<User>(`/users/${id}`),
  updateUser: (id: string, payload: Partial<Pick<UserCreate, "name" | "fit_preference" | "photo_consent">>) =>
    request<User>(`/users/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  putMeasurements: (id: string, payload: Measurements) =>
    request(`/users/${id}/measurements`, { method: "PUT", body: JSON.stringify(payload) }),
  uploadPhoto: (id: string, file: File, consent: boolean) => {
    const form = new FormData();
    form.append("file", file);
    form.append("consent", String(consent));
    return request<PhotoAnalysis>(`/users/${id}/photo`, { method: "POST", body: form });
  },

  // Motor
  recommend: (payload: RecommendationRequest, apiKey?: string) =>
    request<RecommendationResponse>("/recommendations", { method: "POST", body: JSON.stringify(payload) }, { apiKey }),
  /** Recupera a analise; com `size`, avalia outro tamanho com as mesmas medidas persistidas (nao persiste). */
  getRecommendation: (analysisId: string, size?: string) =>
    request<RecommendationResponse>(`/recommendations/${analysisId}${size ? `?size=${encodeURIComponent(size)}` : ""}`),
  feedback: (payload: FeedbackCreate) => request<Feedback>("/feedback", { method: "POST", body: JSON.stringify(payload) }),
  engineConfig: () => request<EngineConfigResponse>("/engine/config"),

  // B2B
  companyDashboard: (apiKey: string) => request<CompanyDashboard>("/companies/me", {}, { apiKey }),
  metrics: (companyId?: string) => request<Metrics>(`/metrics/dashboard${companyId ? `?company_id=${companyId}` : ""}`),
};

export type Api = typeof api;
