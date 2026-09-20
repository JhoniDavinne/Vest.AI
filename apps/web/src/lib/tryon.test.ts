import { describe, expect, it } from "vitest";
import type { TryOnJob } from "@veste-ai/contracts";
import { ApiError } from "./api";
import { TRYON_COPY, initialTryOnState, isBusyPhase, isFormPhase, mapTryOnError, msUntilExpiry, tryOnReducer } from "./tryon";

const file = { name: "foto.jpg", type: "image/jpeg", size: 1234 } as unknown as File;

const job: TryOnJob = {
  job_id: "j1",
  status: "completed",
  analysis_id: "a1",
  product_id: "p1",
  sku: "CAMISETA-001-M",
  size: "M",
  recommended_size: "M",
  provider: "catvton",
  cached: false,
  image_url: "/api/v1/tryon/j1/image",
  duration_ms: 36000,
  error_code: null,
  created_at: "2026-09-20T20:00:00Z",
  expires_at: "2026-09-20T20:15:00Z",
  disclaimer: TRYON_COPY.disclaimer,
  size_note: TRYON_COPY.sizeNote,
};

describe("tryOnReducer — fluxo principal", () => {
  it("idle -> consent_required ao abrir 'Ver em meu corpo'", () => {
    const s = tryOnReducer(initialTryOnState, { type: "open" });
    expect(s.phase).toBe("consent_required");
    expect(TRYON_COPY.idle).toBe("Ver em meu corpo");
  });

  it("nao envia sem consentimento especifico (nao reutiliza consentimento da analise)", () => {
    let s = tryOnReducer(initialTryOnState, { type: "open" });
    s = tryOnReducer(s, { type: "pick_file", file });
    s = tryOnReducer(s, { type: "submit" });
    expect(s.phase).toBe("consent_required");
    expect(s.message).toBe("Aceite o processamento da foto para continuar.");
    expect(s.errorCode).toBe("consent_required");
  });

  it("nao envia sem foto", () => {
    let s = tryOnReducer(initialTryOnState, { type: "open" });
    s = tryOnReducer(s, { type: "set_consent", value: true });
    s = tryOnReducer(s, { type: "submit" });
    expect(s.phase).toBe("consent_required");
    expect(s.message).toMatch(/Selecione uma foto/);
  });

  it("consentimento + foto -> uploading -> processing -> completed", () => {
    let s = tryOnReducer(initialTryOnState, { type: "open" });
    s = tryOnReducer(s, { type: "set_consent", value: true });
    s = tryOnReducer(s, { type: "pick_file", file });
    s = tryOnReducer(s, { type: "submit" });
    expect(s.phase).toBe("uploading");
    expect(isBusyPhase(s.phase)).toBe(true);
    s = tryOnReducer(s, { type: "uploaded" });
    expect(s.phase).toBe("processing");
    s = tryOnReducer(s, { type: "completed", job });
    expect(s.phase).toBe("completed");
    expect(s.job?.image_url).toBe("/api/v1/tryon/j1/image");
    expect(s.job?.recommended_size).toBe("M");
  });

  it("expired limpa o job e pede nova geracao; reset preserva consentimento", () => {
    let s = tryOnReducer({ ...initialTryOnState, consent: true, phase: "completed", job }, { type: "expired" });
    expect(s.phase).toBe("expired");
    expect(s.job).toBeNull();
    expect(s.message).toBe("O resultado expirou. Gere uma nova visualização.");
    expect(isFormPhase(s.phase)).toBe(true);
    s = tryOnReducer(s, { type: "reset" });
    expect(s.phase).toBe("idle");
    expect(s.consent).toBe(true);
  });
});

describe("mapTryOnError — erros do provider nunca quebram a recomendacao", () => {
  const cases: Array<[string, number, string, string | RegExp]> = [
    ["provider_unavailable", 503, "provider_unavailable", TRYON_COPY.provider_unavailable],
    ["provider_out_of_memory", 503, "provider_unavailable", TRYON_COPY.provider_unavailable],
    ["tryon_disabled", 503, "provider_unavailable", TRYON_COPY.provider_unavailable],
    ["provider_busy", 503, "failed", /ocupado/],
    ["provider_timeout", 504, "failed", /demorou mais que o esperado/],
    ["result_expired", 410, "expired", TRYON_COPY.expired],
    ["consent_required", 422, "consent_required", TRYON_COPY.consent_required],
    ["flat_image_unavailable", 422, "failed", TRYON_COPY.unsupportedProduct],
    ["provider_error", 502, "failed", TRYON_COPY.failed],
  ];
  it.each(cases)("%s -> fase %s", (code, status, phase, message) => {
    const mapped = mapTryOnError(new ApiError("detalhe interno", status, code));
    expect(mapped.phase).toBe(phase);
    if (typeof message === "string") expect(mapped.message).toBe(message);
    else expect(mapped.message).toMatch(message);
  });

  it("erro de foto invalida usa a mensagem controlada da API", () => {
    const mapped = mapTryOnError(new ApiError("A foto deve ter pelo menos 256px no menor lado.", 400, "invalid_photo"));
    expect(mapped.phase).toBe("failed");
    expect(mapped.message).toMatch(/256px/);
  });

  it("falha de rede (API offline) -> provider_unavailable; erro desconhecido -> failed generico", () => {
    expect(mapTryOnError(new ApiError("x", 0, "network_error")).phase).toBe("provider_unavailable");
    expect(mapTryOnError(new ApiError("x", 500)).phase).toBe("provider_unavailable");
    const unknown = mapTryOnError(new Error("stack trace interno"));
    expect(unknown.phase).toBe("failed");
    expect(unknown.message).toBe(TRYON_COPY.failed);
    expect(unknown.message).not.toMatch(/stack/);
  });

  it("busy propaga retry_after", () => {
    const mapped = mapTryOnError(new ApiError("busy", 503, "provider_busy", 10));
    expect(mapped.retryAfterSeconds).toBe(10);
    const s = tryOnReducer({ ...initialTryOnState, phase: "processing" }, { type: "failed", error: new ApiError("b", 503, "provider_busy", 7) });
    expect(s.phase).toBe("failed");
    expect(s.retryAfterSeconds).toBe(7);
  });
});

describe("msUntilExpiry", () => {
  it("calcula o tempo restante e nunca negativo", () => {
    const now = Date.parse("2026-09-20T20:10:00Z");
    expect(msUntilExpiry(job, now)).toBe(5 * 60 * 1000);
    expect(msUntilExpiry(job, now + 10 * 60 * 1000)).toBe(0);
    expect(msUntilExpiry(null)).toBeNull();
    expect(msUntilExpiry({ ...job, expires_at: null })).toBeNull();
  });
});
