import * as React from "react";
import type {
  Confidence,
  FitPreference,
  Measurements,
  RecommendationResponse,
  RegionKey,
  RegionStatus,
} from "@veste-ai/contracts";
import {
  CONFIDENCE_LABEL,
  FIT_PREFERENCE_LABEL,
  REGION_LABEL,
  REGION_STATUS_LABEL,
} from "@veste-ai/contracts";
import { VesteClient } from "./client";
import { WidgetFitPreview3D } from "./fit-preview-3d";
import { ensureStyles } from "./styles";

export interface VesteFitProps {
  /** Id ou slug do produto na VESTE.AI. */
  productId?: string;
  /** SKU especifico (ex.: CAMISETA-001-M). Se informado, tem prioridade. */
  sku?: string;
  /** URL base da API. Padrao: http://localhost:8000 */
  apiBaseUrl?: string;
  /** Chave de integracao da empresa (X-API-Key). */
  apiKey?: string;
  /** Medidas iniciais (ex.: perfil autorizado da loja). */
  initialMeasurements?: Measurements;
  initialPreference?: FitPreference;
  /** Cor de acento para combinar com a loja hospedeira. */
  accentColor?: string;
  /** Texto do botao. */
  label?: string;
  /** Chamado quando o consumidor seleciona um tamanho ("Adicionar ao carrinho"). */
  onSelectSize?: (size: string, result: RecommendationResponse) => void;
  onResult?: (result: RecommendationResponse) => void;
  /** Abre o modal ja no primeiro render (uso em demonstracoes). */
  defaultOpen?: boolean;
  /** Carrega o provador visual 3D no passo de resultado (lazy). */
  enable3D?: boolean;
}

type Step = "form" | "loading" | "result";

const STATUS_COLOR: Record<RegionStatus, string> = {
  good: "var(--vf-sage)",
  attention: "var(--vf-amber)",
  ease_recommended: "var(--vf-clay)",
  not_evaluated: "var(--vf-slate)",
};

const CONFIDENCE_COLOR: Record<Confidence, string> = {
  high: "var(--vf-sage)",
  medium: "var(--vf-amber)",
  low: "var(--vf-clay)",
};

const FIELDS: { key: keyof Measurements; label: string; placeholder: string }[] = [
  { key: "height", label: "Altura (cm)", placeholder: "180" },
  { key: "weight", label: "Peso (kg)", placeholder: "78" },
  { key: "chest", label: "Peito / tórax (cm)", placeholder: "102" },
  { key: "waist", label: "Cintura (cm)", placeholder: "88" },
  { key: "hip", label: "Quadril (cm)", placeholder: "100" },
  { key: "shoulder", label: "Ombros (cm)", placeholder: "45" },
];

function formatScore(value: number): string {
  return value.toFixed(1).replace(".", ",");
}

export function VesteFit({
  productId,
  sku,
  apiBaseUrl = "http://localhost:8000",
  apiKey,
  initialMeasurements,
  initialPreference = "regular",
  accentColor,
  label = "Descubra seu tamanho ideal",
  onSelectSize,
  onResult,
  defaultOpen = false,
  enable3D = true,
}: VesteFitProps) {
  const [open, setOpen] = React.useState(defaultOpen);
  const [step, setStep] = React.useState<Step>("form");
  const [values, setValues] = React.useState<Record<keyof Measurements, string>>(() => ({
    height: initialMeasurements?.height?.toString() ?? "",
    weight: initialMeasurements?.weight?.toString() ?? "",
    chest: initialMeasurements?.chest?.toString() ?? "",
    waist: initialMeasurements?.waist?.toString() ?? "",
    hip: initialMeasurements?.hip?.toString() ?? "",
    shoulder: initialMeasurements?.shoulder?.toString() ?? "",
  }));
  const [preference, setPreference] = React.useState<FitPreference>(initialPreference);
  const [result, setResult] = React.useState<RecommendationResponse | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedSize, setSelectedSize] = React.useState<string | null>(null);

  React.useEffect(() => {
    ensureStyles();
  }, []);

  const client = React.useMemo(() => new VesteClient({ apiBaseUrl, apiKey }), [apiBaseUrl, apiKey]);

  const measurements = React.useMemo<Measurements>(() => {
    const parsed: Measurements = {};
    (Object.keys(values) as (keyof Measurements)[]).forEach((key) => {
      const raw = values[key].replace(",", ".");
      const num = Number(raw);
      parsed[key] = raw.trim() === "" || Number.isNaN(num) ? null : num;
    });
    return parsed;
  }, [values]);

  const canSubmit = ["chest", "waist", "hip"].every(
    (k) => measurements[k as keyof Measurements] != null,
  );

  async function submit(evaluateSize?: string) {
    setError(null);
    setStep("loading");
    try {
      const response = await client.recommend({
        sku: evaluateSize ? undefined : sku,
        productId: evaluateSize || !sku ? productId ?? result?.product_id : undefined,
        size: evaluateSize,
        customer: measurements,
        fitPreference: preference,
      });
      setResult(response);
      setSelectedSize(response.recommended_size);
      onResult?.(response);
      // pequena pausa para o "processamento" ser perceptivel na demonstracao
      await new Promise((r) => setTimeout(r, 350));
      setStep("result");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível calcular a recomendação.");
      setStep("form");
    }
  }

  function close() {
    setOpen(false);
  }

  const rootStyle = accentColor ? ({ "--vf-accent": accentColor } as React.CSSProperties) : undefined;

  return (
    <div className="vf-root" style={rootStyle}>
      <button type="button" className="vf-trigger" onClick={() => setOpen(true)} data-testid="vf-trigger">
        <span className="vf-trigger-mark" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 32 32" fill="none">
            <path d="M6 8.5 12 5l4 3 4-3 6 3.5-2.5 5-3.5-1.5V27h-8V12l-3.5 1.5L6 8.5Z" stroke="#fff" strokeWidth="2.2" strokeLinejoin="round" />
          </svg>
        </span>
        {label}
        <span className="vf-trigger-brand">VESTE.AI</span>
      </button>

      {open ? (
        <div className="vf-overlay" role="dialog" aria-modal="true" onClick={close}>
          <div className="vf-modal" onClick={(e) => e.stopPropagation()}>
            <div className="vf-modal-head">
              <span className="vf-logo">
                VESTE<b>.</b>AI
              </span>
              <button type="button" className="vf-close" onClick={close} aria-label="Fechar">
                ×
              </button>
            </div>
            <div className="vf-body">
              <div className="vf-steps" aria-hidden="true">
                <i className="on" />
                <i className={step !== "form" ? "on" : ""} />
                <i className={step === "result" ? "on" : ""} />
              </div>

              {step === "form" ? (
                <>
                  <h3 className="vf-title">Descubra seu tamanho ideal</h3>
                  <p className="vf-sub">
                    Informe suas medidas. A VESTE.AI estima como esta peça tende a vestir — sem avaliar o seu corpo.
                  </p>
                  <div className="vf-grid">
                    {FIELDS.map((field) => (
                      <div className="vf-field" key={field.key}>
                        <label htmlFor={`vf-${field.key}`}>{field.label}</label>
                        <input
                          id={`vf-${field.key}`}
                          inputMode="decimal"
                          placeholder={field.placeholder}
                          value={values[field.key]}
                          onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="vf-field" style={{ marginTop: 12 }}>
                    <label>Preferência de caimento</label>
                    <div className="vf-seg" role="radiogroup">
                      {(["tight", "regular", "loose"] as FitPreference[]).map((p) => (
                        <button
                          key={p}
                          type="button"
                          role="radio"
                          aria-checked={preference === p}
                          className={preference === p ? "on" : ""}
                          onClick={() => setPreference(p)}
                        >
                          {FIT_PREFERENCE_LABEL[p]}
                        </button>
                      ))}
                    </div>
                  </div>
                  {error ? <div className="vf-error">{error}</div> : null}
                  <button type="button" className="vf-cta" disabled={!canSubmit} onClick={() => submit()}>
                    Analisar caimento
                  </button>
                  <p className="vf-note">
                    Estimativa de compatibilidade entre pessoa e peça · Motor VESTE.AI · Sem uso de foto neste canal
                  </p>
                </>
              ) : null}

              {step === "loading" ? (
                <div className="vf-loading">
                  <div className="vf-spinner" />
                  <strong>Cruzando medidas, modelagem e tecido…</strong>
                  <p style={{ margin: "6px 0 0" }}>O motor VESTE.AI compara cada tamanho com as medidas informadas.</p>
                </div>
              ) : null}

              {step === "result" && result ? (
                <ResultView
                  result={result}
                  selectedSize={selectedSize ?? result.recommended_size}
                  onSelectSize={(size) => setSelectedSize(size)}
                  onEvaluate={(size) => submit(size)}
                  onBack={() => setStep("form")}
                  onConfirm={() => {
                    onSelectSize?.(selectedSize ?? result.recommended_size, result);
                    close();
                  }}
                  enable3D={enable3D}
                />
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

interface ResultViewProps {
  result: RecommendationResponse;
  selectedSize: string;
  onSelectSize: (size: string) => void;
  onEvaluate: (size: string) => void;
  onBack: () => void;
  onConfirm: () => void;
  enable3D?: boolean;
}

function ResultView({ result, selectedSize, onSelectSize, onEvaluate, onBack, onConfirm, enable3D = true }: ResultViewProps) {
  const selected = result.comparison.find((c) => c.size === selectedSize) ?? result.comparison[0];
  const regionEntries = Object.entries(result.regional_analysis) as [RegionKey, RegionStatus][];
  return (
    <>
      <h3 className="vf-title" style={{ marginBottom: 0 }}>
        {result.product_name}
      </h3>
      <p className="vf-sub" style={{ marginBottom: 12 }}>
        {result.scale_label}: {result.scale_message}
      </p>
      <div className="vf-result">
        <div className="vf-size">
          <b>{result.recommended_size}</b>
          <span>recomendado</span>
        </div>
        <div>
          <div className="vf-score">
            {formatScore(result.fit_score)} <small>/ 10</small>
          </div>
          <div className="vf-badge">
            <i style={{ background: CONFIDENCE_COLOR[result.confidence] }} />
            Confiança {CONFIDENCE_LABEL[result.confidence].toLowerCase()}
          </div>
        </div>
      </div>

      <WidgetFitPreview3D payload={result.fit_preview ?? null} enabled={enable3D} />

      <div className="vf-regions">
        {regionEntries.map(([region, status]) => (
          <div className="vf-region" key={region}>
            <small>{REGION_LABEL[region]}</small>
            <i style={{ background: STATUS_COLOR[status] }} />
            <span>{REGION_STATUS_LABEL[status]}</span>
          </div>
        ))}
      </div>

      <div className="vf-field">
        <label>Comparar tamanhos</label>
        <div className="vf-compare">
          {result.comparison.map((c) => (
            <button
              key={c.sku}
              type="button"
              className={c.recommended ? "rec" : ""}
              style={c.size === selectedSize && !c.recommended ? { borderColor: "var(--vf-ink)" } : undefined}
              onClick={() => {
                onSelectSize(c.size);
                if (c.size !== result.evaluated_size) onEvaluate(c.size);
              }}
            >
              <b>{c.size}</b>
              <span>{formatScore(c.fit_score)}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="vf-explain">{result.explanation}</div>
      {selected && selected.size !== result.recommended_size ? (
        <div className="vf-explain" style={{ marginTop: 8 }}>
          {result.recommendation}
        </div>
      ) : null}

      <div className="vf-actions">
        <button type="button" className="vf-ghost" onClick={onBack}>
          Ajustar medidas
        </button>
        <button type="button" className="vf-primary" onClick={onConfirm}>
          Usar tamanho {selectedSize}
        </button>
      </div>
      <p className="vf-note">Análise não avalia a aparência do corpo. Parâmetros heurísticos do MVP.</p>
    </>
  );
}
