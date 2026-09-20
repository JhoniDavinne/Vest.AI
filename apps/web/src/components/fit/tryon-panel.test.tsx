/**
 * Renderizacao estatica (react-dom/server) do painel por estado: sem DOM/jsdom, sem provider.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { TryOnJob } from "@veste-ai/contracts";
import { initialTryOnState, TRYON_COPY, type TryOnState } from "@/lib/tryon";
import { TryOnPanel } from "./tryon-panel";

const job: TryOnJob = {
  job_id: "j1",
  status: "completed",
  analysis_id: "a1",
  product_id: "p1",
  sku: "CAMISETA-001-L",
  size: "L",
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

const noop = () => undefined;

function render(state: Partial<TryOnState>, overrides: Partial<Parameters<typeof TryOnPanel>[0]> = {}) {
  return renderToStaticMarkup(
    <TryOnPanel
      state={{ ...initialTryOnState, ...state }}
      size="L"
      recommendedSize="M"
      productSupported
      providerEnabled
      providerAvailable
      imageUrl="http://localhost:8000/api/v1/tryon/j1/image"
      onOpen={noop}
      onConsentChange={noop}
      onPickFile={noop}
      onSubmit={noop}
      onReset={noop}
      {...overrides}
    />,
  );
}

describe("TryOnPanel", () => {
  it("nao renderiza quando o try-on esta desativado na API", () => {
    expect(render({}, { providerEnabled: false })).toBe("");
  });

  it("idle: secao experimental com 'Ver em meu corpo' e nota sobre a recomendacao", () => {
    const html = render({ phase: "idle" });
    expect(html).toContain("Provador com foto");
    expect(html).toContain("Experimental");
    expect(html).toContain("Ver em meu corpo");
    expect(html).toContain("não na imagem gerada");
    expect(html).toContain("recomendado:"); // L visualizado x M recomendado
    expect(html).toContain('data-phase="idle"');
  });

  it("consent_required: checkbox de consentimento, upload e botao desabilitado sem consentimento", () => {
    const html = render({ phase: "consent_required", message: TRYON_COPY.consent_required, errorCode: "consent_required" });
    expect(html).toContain('data-testid="tryon-consent"');
    expect(html).toContain("Aceite o processamento da foto para continuar.");
    expect(html).toContain('type="file"');
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*data-testid="tryon-submit"/);
    expect(html).toContain("Consentimento específico para esta visualização");
  });

  it("uploading / processing: mensagens de carregamento", () => {
    expect(render({ phase: "uploading" })).toContain("Enviando foto...");
    const processing = render({ phase: "processing" });
    expect(processing).toContain("Gerando sua visualização...");
    expect(processing).toContain("recomendação de tamanho já está pronta");
    expect(processing).not.toContain('type="file"');
  });

  it("completed: imagem via proxy da API, disclaimer e nota sobre o tamanho", () => {
    const html = render({ phase: "completed", job });
    expect(html).toContain('src="http://localhost:8000/api/v1/tryon/j1/image"');
    expect(html).toContain("Visualização gerada por IA. O caimento real pode apresentar diferenças.");
    expect(html).toContain("não na imagem gerada");
    expect(html).toContain("Tamanho L");
    expect(html).toContain("36 s");
    expect(html).not.toContain("8100"); // nunca a URL do provider
  });

  it("completed com cache: badge de reaproveitamento", () => {
    expect(render({ phase: "completed", job: { ...job, cached: true } })).toContain("Resultado reaproveitado");
  });

  it("failed: mensagem controlada e formulario para tentar novamente", () => {
    const html = render({ phase: "failed", message: TRYON_COPY.failed, errorCode: "provider_error" });
    expect(html).toContain("Não foi possível gerar a visualização.");
    expect(html).toContain('role="alert"');
    expect(html).toContain("Gerar novamente");
    expect(html).not.toMatch(/Traceback|stack/i);
  });

  it("provider_unavailable: recomendacao continua disponivel", () => {
    const html = render({ phase: "provider_unavailable", message: TRYON_COPY.provider_unavailable });
    expect(html).toContain("A visualização em IA está temporariamente indisponível.");
    expect(html).toContain("Sua recomendação de tamanho continua disponível.");
    expect(html).toContain("Tentar novamente");
    expect(html).not.toContain('type="file"');
  });

  it("provider indisponivel no health (idle): mesma mensagem de indisponibilidade", () => {
    const html = render({ phase: "idle" }, { providerAvailable: false });
    expect(html).toContain("temporariamente indisponível");
    expect(html).not.toContain("Ver em meu corpo");
  });

  it("expired: pede nova geracao", () => {
    const html = render({ phase: "expired", message: TRYON_COPY.expired });
    expect(html).toContain("O resultado expirou. Gere uma nova visualização.");
    expect(html).toContain('type="file"');
  });

  it("produto sem imagem flat: nao oferece try-on", () => {
    const html = render({ phase: "idle" }, { productSupported: false });
    expect(html).toContain("ainda não possui imagem compatível");
    expect(html).not.toContain("Ver em meu corpo");
  });
});
