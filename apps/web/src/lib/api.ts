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

const LOCAL_API_URL = "http://localhost:8000";
const PRODUCTION_API_URL = "https://veste-api.onrender.com";

function resolveConfiguredApiUrl(): string | undefined {
  const raw =
    typeof window === "undefined"
      ? process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL
      : process.env.NEXT_PUBLIC_API_URL;
  const normalized = raw?.trim().replace(/\/$/, "");
  return normalized || undefined;
}

/** URL base da API (servidor usa API_URL; navegador usa NEXT_PUBLIC_API_URL). */
export function apiBaseUrl(): string {
  const configured = resolveConfiguredApiUrl();
  if (configured && configured !== LOCAL_API_URL) {
    return configured;
  }
  if (process.env.VERCEL || process.env.NODE_ENV === "production") {
    return PRODUCTION_API_URL;
  }
  return configured ?? LOCAL_API_URL;
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

  const url = `${apiBaseUrl()}${API_V1_PREFIX}${path}`;
  const fetchOptions: RequestInit = { ...init, headers, cache: "no-store" };
  const maxAttempts = typeof window === "undefined" && process.env.VERCEL ? 3 : 1;
  let response: Response | undefined;
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      response = await fetch(url, fetchOptions);
      break;
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, 2500));
      }
    }
  }
  if (!response) {
    throw lastError instanceof Error ? lastError : new Error("Falha ao conectar na API.");
  }
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
  if (response.status === 204) {
    return undefined as T;
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
  uploadProductImage: (file: File, apiKey?: string) => {
    const form = new FormData();
    form.append("file", file);
    return request<{ image_url: string }>("/products/upload-image", { method: "POST", body: form }, { apiKey });
  },
  updateProductImage: (idOrSlug: string, imageUrl: string, apiKey?: string) =>
    request<Product>(
      `/products/${encodeURIComponent(idOrSlug)}/image`,
      { method: "PATCH", body: JSON.stringify({ image_url: imageUrl }) },
      { apiKey },
    ),
  updateProductImages: (idOrSlug: string, images: string[], apiKey?: string) =>
    request<Product>(
      `/products/${encodeURIComponent(idOrSlug)}/images`,
      { method: "PATCH", body: JSON.stringify({ images }) },
      { apiKey },
    ),
  deleteProduct: (idOrSlug: string, apiKey?: string) =>
    request<void>(
      `/products/${encodeURIComponent(idOrSlug)}`,
      { method: "DELETE" },
      { apiKey },
    ),

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
  getRecommendation: (analysisId: string) => request<RecommendationResponse>(`/recommendations/${analysisId}`),
  feedback: (payload: FeedbackCreate) => request<Feedback>("/feedback", { method: "POST", body: JSON.stringify(payload) }),
  engineConfig: () => request<EngineConfigResponse>("/engine/config"),

  // B2B
  companyDashboard: (apiKey: string) => request<CompanyDashboard>("/companies/me", {}, { apiKey }),
  metrics: (companyId?: string) => request<Metrics>(`/metrics/dashboard${companyId ? `?company_id=${companyId}` : ""}`),
};

export type Api = typeof api;
