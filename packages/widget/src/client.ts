import type {
  FitPreference,
  Measurements,
  RecommendationRequest,
  RecommendationResponse,
} from "@veste-ai/contracts";
import { API_V1_PREFIX } from "@veste-ai/contracts";

export interface VesteClientOptions {
  /** URL base da API VESTE.AI, ex.: https://api.veste.ai */
  apiBaseUrl: string;
  /** Chave de integracao da empresa (X-API-Key). */
  apiKey?: string;
  fetchImpl?: typeof fetch;
}

export interface RecommendParams {
  sku?: string;
  productId?: string;
  size?: string;
  customer: Measurements;
  fitPreference: FitPreference;
}

export class VesteClient {
  private readonly base: string;
  private readonly apiKey?: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: VesteClientOptions) {
    this.base = options.apiBaseUrl.replace(/\/$/, "");
    this.apiKey = options.apiKey;
    this.fetchImpl = options.fetchImpl ?? fetch.bind(globalThis);
  }

  buildRequest(params: RecommendParams): RecommendationRequest {
    return {
      sku: params.sku,
      product_id: params.productId,
      size: params.size,
      customer: params.customer,
      fit_preference: params.fitPreference,
      channel: "widget",
      use_photo: false,
    };
  }

  async recommend(params: RecommendParams): Promise<RecommendationResponse> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (this.apiKey) headers["X-API-Key"] = this.apiKey;
    const response = await this.fetchImpl(`${this.base}${API_V1_PREFIX}/recommendations`, {
      method: "POST",
      headers,
      body: JSON.stringify(this.buildRequest(params)),
    });
    if (!response.ok) {
      let detail = `Erro ${response.status}`;
      try {
        const body = (await response.json()) as { detail?: unknown };
        if (typeof body.detail === "string") detail = body.detail;
      } catch {
        /* corpo nao-JSON */
      }
      throw new Error(detail);
    }
    return (await response.json()) as RecommendationResponse;
  }
}
