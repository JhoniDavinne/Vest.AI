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
  TryOnAvailability,
  TryOnJob,
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
    /** Codigo estavel opcional (ex.: erros do provador com foto: `provider_busy`). */
    public readonly code: string | null = null,
    public readonly retryAfterSeconds: number | null = null,
  ) {
    super(message);
  }
}

/** Extrai `{ detail, code, retry_after_seconds }` de um corpo de erro da API (string ou JSON). */
export function parseApiError(status: number, rawBody: string | null): ApiError {
  let detail = `Erro ${status}`;
  let code: string | null = null;
  let retryAfter: number | null = null;
  if (rawBody) {
    try {
      const body = JSON.parse(rawBody) as { detail?: unknown; code?: unknown; retry_after_seconds?: unknown };
      if (typeof body.detail === "string") detail = body.detail;
      else if (Array.isArray(body.detail)) {
        detail = body.detail
          .map((d: { msg?: string; loc?: unknown[] }) => `${(d.loc ?? []).slice(-1)[0] ?? ""}: ${d.msg ?? ""}`)
          .join("; ");
      }
      if (typeof body.code === "string") code = body.code;
      if (typeof body.retry_after_seconds === "number") retryAfter = body.retry_after_seconds;
    } catch {
      /* corpo nao-JSON */
    }
  }
  return new ApiError(detail, status, code, retryAfter);
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
    let raw: string | null = null;
    try {
      raw = await response.text();
    } catch {
      /* sem corpo */
    }
    throw parseApiError(response.status, raw);
  }
  return (await response.json()) as T;
}

/**
 * Upload multipart com callback de fim de envio (XMLHttpRequest): permite distinguir
 * "Enviando foto..." de "Gerando sua visualizacao..." enquanto a v1 do try-on e sincrona.
 */
function upload<T>(path: string, form: FormData, options: { onUploaded?: () => void; signal?: AbortSignal } = {}): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${apiBaseUrl()}${API_V1_PREFIX}${path}`);
    xhr.responseType = "text";
    xhr.upload.onload = () => options.onUploaded?.();
    xhr.onerror = () => reject(new ApiError("Não foi possível conectar à API.", 0, "network_error"));
    xhr.onabort = () => reject(new ApiError("Envio cancelado.", 0, "aborted"));
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText) as T);
        } catch {
          reject(new ApiError("Resposta inválida da API.", xhr.status));
        }
      } else {
        reject(parseApiError(xhr.status, xhr.responseText));
      }
    };
    options.signal?.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.send(form);
  });
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

  // Provador com foto (experimental). O frontend NUNCA chama o provider (apps/tryon) diretamente:
  // tudo passa pela API principal, que valida consentimento/analise/peca e faz proxy da imagem.
  tryOnStatus: () => request<TryOnAvailability>("/tryon/status"),
  tryOn: (
    payload: { analysisId: string; size?: string; photo: File; consentTryOn: boolean },
    options: { onUploaded?: () => void; signal?: AbortSignal } = {},
  ) => {
    const form = new FormData();
    // Nome de arquivo fixo: o nome original da foto nao e enviado.
    form.append("person", payload.photo, "photo");
    form.append("analysis_id", payload.analysisId);
    form.append("consent_tryon", String(payload.consentTryOn));
    if (payload.size) form.append("size", payload.size);
    return upload<TryOnJob>("/tryon", form, options);
  },
  tryOnJob: (jobId: string) => request<TryOnJob>(`/tryon/${encodeURIComponent(jobId)}`),
  /** URL absoluta da imagem gerada (proxy da API; expira). */
  tryOnImageUrl: (job: TryOnJob) => (job.image_url ? `${apiBaseUrl()}${job.image_url}` : null),
  deleteTryOn: (jobId: string) =>
    fetch(`${apiBaseUrl()}${API_V1_PREFIX}/tryon/${encodeURIComponent(jobId)}`, { method: "DELETE" }).then(() => undefined),

  // B2B
  companyDashboard: (apiKey: string) => request<CompanyDashboard>("/companies/me", {}, { apiKey }),
  metrics: (companyId?: string) => request<Metrics>(`/metrics/dashboard${companyId ? `?company_id=${companyId}` : ""}`),
};

export type Api = typeof api;
