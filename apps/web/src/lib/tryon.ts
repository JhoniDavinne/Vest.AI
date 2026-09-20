/**
 * Maquina de estados do "Provador com foto" (virtual try-on, experimental).
 *
 * Pura e testavel: o componente (`components/fit/tryon-panel.tsx`) apenas renderiza o estado
 * e dispara eventos. A recomendacao de tamanho NUNCA depende deste fluxo — em qualquer estado
 * de falha ela continua visivel.
 */
import type { TryOnErrorCode, TryOnJob } from "@veste-ai/contracts";
import { ApiError } from "./api";

export type TryOnPhase =
  | "idle"
  | "consent_required"
  | "uploading"
  | "processing"
  | "completed"
  | "failed"
  | "provider_unavailable"
  | "expired";

export interface TryOnState {
  phase: TryOnPhase;
  /** Consentimento especifico para processamento da foto (nao reutiliza o da analise corporal). */
  consent: boolean;
  file: File | null;
  job: TryOnJob | null;
  /** Mensagem controlada exibida ao usuario (nunca stack trace). */
  message: string | null;
  /** Codigo estavel do ultimo erro (telemetria/UI). */
  errorCode: string | null;
  retryAfterSeconds: number | null;
}

export type TryOnEvent =
  | { type: "open" }
  | { type: "set_consent"; value: boolean }
  | { type: "pick_file"; file: File | null }
  | { type: "submit" }
  | { type: "uploaded" }
  | { type: "completed"; job: TryOnJob }
  | { type: "failed"; error: unknown }
  | { type: "expired" }
  | { type: "provider_unavailable" }
  | { type: "reset" };

export const TRYON_COPY = {
  idle: "Ver em meu corpo",
  consent_required: "Aceite o processamento da foto para continuar.",
  uploading: "Enviando foto...",
  processing: "Gerando sua visualização...",
  failed: "Não foi possível gerar a visualização.",
  provider_unavailable:
    "A visualização em IA está temporariamente indisponível. Sua recomendação de tamanho continua disponível.",
  expired: "O resultado expirou. Gere uma nova visualização.",
  disclaimer: "Visualização gerada por IA. O caimento real pode apresentar diferenças.",
  sizeNote: "A recomendação de tamanho é baseada nas medidas e dados técnicos da peça, não na imagem gerada.",
  unsupportedProduct: "Esta peça ainda não possui imagem compatível com o provador com foto.",
} as const;

export const initialTryOnState: TryOnState = {
  phase: "idle",
  consent: false,
  file: null,
  job: null,
  message: null,
  errorCode: null,
  retryAfterSeconds: null,
};

const UNAVAILABLE_CODES: ReadonlySet<string> = new Set<TryOnErrorCode | "network_error">([
  "tryon_disabled",
  "provider_unavailable",
  "provider_out_of_memory",
  "network_error",
]);

/** Traduz um erro da API/provider para fase + mensagem controlada. */
export function mapTryOnError(error: unknown): { phase: TryOnPhase; message: string; code: string | null; retryAfterSeconds: number | null } {
  if (error instanceof ApiError) {
    const code = error.code;
    if (code === "consent_required") {
      return { phase: "consent_required", message: TRYON_COPY.consent_required, code, retryAfterSeconds: null };
    }
    if (code === "result_expired") {
      return { phase: "expired", message: TRYON_COPY.expired, code, retryAfterSeconds: null };
    }
    if (code && UNAVAILABLE_CODES.has(code)) {
      return { phase: "provider_unavailable", message: TRYON_COPY.provider_unavailable, code, retryAfterSeconds: error.retryAfterSeconds };
    }
    if (code === "provider_busy") {
      return {
        phase: "failed",
        message: "O provador está ocupado no momento. Tente novamente em instantes.",
        code,
        retryAfterSeconds: error.retryAfterSeconds ?? 10,
      };
    }
    if (code === "provider_timeout") {
      return { phase: "failed", message: "A geração demorou mais que o esperado. Tente novamente.", code, retryAfterSeconds: null };
    }
    if (code === "invalid_photo" || code === "photo_too_large" || code === "unsupported_photo_type" || code === "provider_rejected_input") {
      return { phase: "failed", message: error.message || TRYON_COPY.failed, code, retryAfterSeconds: null };
    }
    if (code === "flat_image_unavailable") {
      return { phase: "failed", message: TRYON_COPY.unsupportedProduct, code, retryAfterSeconds: null };
    }
    if (code === "provider_error" || code === "invalid_size") {
      return { phase: "failed", message: TRYON_COPY.failed, code, retryAfterSeconds: null };
    }
    // Sem codigo conhecido: API fora do ar (status 0) ou erro de servidor -> indisponivel.
    if (error.status === 0 || error.status >= 500) {
      return { phase: "provider_unavailable", message: TRYON_COPY.provider_unavailable, code, retryAfterSeconds: null };
    }
    return { phase: "failed", message: TRYON_COPY.failed, code, retryAfterSeconds: null };
  }
  return { phase: "failed", message: TRYON_COPY.failed, code: null, retryAfterSeconds: null };
}

export function tryOnReducer(state: TryOnState, event: TryOnEvent): TryOnState {
  switch (event.type) {
    case "open":
      return { ...state, phase: "consent_required", message: null, errorCode: null, retryAfterSeconds: null };
    case "set_consent":
      return { ...state, consent: event.value, message: null };
    case "pick_file":
      return { ...state, file: event.file, message: null, errorCode: null };
    case "submit":
      if (!state.consent) {
        return { ...state, phase: "consent_required", message: TRYON_COPY.consent_required, errorCode: "consent_required" };
      }
      if (!state.file) {
        return { ...state, phase: "consent_required", message: "Selecione uma foto para continuar.", errorCode: null };
      }
      return { ...state, phase: "uploading", job: null, message: null, errorCode: null, retryAfterSeconds: null };
    case "uploaded":
      return state.phase === "uploading" ? { ...state, phase: "processing" } : state;
    case "completed":
      return { ...state, phase: "completed", job: event.job, message: null, errorCode: null, retryAfterSeconds: null };
    case "failed": {
      const mapped = mapTryOnError(event.error);
      return { ...state, phase: mapped.phase, message: mapped.message, errorCode: mapped.code, retryAfterSeconds: mapped.retryAfterSeconds, job: null };
    }
    case "expired":
      return { ...state, phase: "expired", message: TRYON_COPY.expired, job: null };
    case "provider_unavailable":
      return { ...state, phase: "provider_unavailable", message: TRYON_COPY.provider_unavailable, job: null };
    case "reset":
      return { ...initialTryOnState, consent: state.consent };
    default: {
      const exhaustive: never = event;
      return exhaustive;
    }
  }
}

/** Fases em que o formulario (consentimento + foto) deve estar visivel. */
export function isFormPhase(phase: TryOnPhase): boolean {
  return phase === "consent_required" || phase === "failed" || phase === "expired";
}

/** Fases em que ha trabalho em andamento (bloquear botoes). */
export function isBusyPhase(phase: TryOnPhase): boolean {
  return phase === "uploading" || phase === "processing";
}

/** Milissegundos ate a expiracao do resultado (ou null se nao houver). */
export function msUntilExpiry(job: TryOnJob | null, now: number = Date.now()): number | null {
  if (!job?.expires_at) return null;
  const ts = Date.parse(job.expires_at);
  return Number.isNaN(ts) ? null : Math.max(0, ts - now);
}
