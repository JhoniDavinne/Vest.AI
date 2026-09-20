"use client";

import * as React from "react";
import { AlertTriangle, Camera, ImagePlus, Info, RotateCcw, ShieldCheck, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TRYON_COPY, isBusyPhase, isFormPhase, type TryOnState } from "@/lib/tryon";

export interface TryOnPanelProps {
  state: TryOnState;
  /** Tamanho que sera renderizado (selecao do usuario ou recomendado pelo motor). */
  size: string;
  recommendedSize: string;
  /** Peca possui imagem flat compativel (Product.tryon_supported). */
  productSupported: boolean;
  /** Provider habilitado/disponivel segundo GET /health da API principal. */
  providerEnabled: boolean;
  providerAvailable: boolean;
  /** URL absoluta (proxy da API) da imagem gerada, quando `completed`. */
  imageUrl: string | null;
  onOpen: () => void;
  onConsentChange: (value: boolean) => void;
  onPickFile: (file: File | null) => void;
  onSubmit: () => void;
  onReset: () => void;
  onImageError?: () => void;
}

/**
 * "Provador com foto" (experimental). Componente puramente apresentacional: recebe o estado da
 * maquina (`lib/tryon.ts`) e dispara eventos. Nao conhece o provider nem chama a API.
 */
export function TryOnPanel(props: TryOnPanelProps) {
  const { state, size, recommendedSize, productSupported, providerEnabled, providerAvailable, imageUrl } = props;
  const inputRef = React.useRef<HTMLInputElement>(null);
  // URL local da foto escolhida (somente no navegador); revogada quando o arquivo muda.
  const preview = React.useMemo(
    () => (state.file && typeof URL !== "undefined" && "createObjectURL" in URL ? URL.createObjectURL(state.file) : null),
    [state.file],
  );
  React.useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  if (!providerEnabled) return null;

  const busy = isBusyPhase(state.phase);
  const showForm = isFormPhase(state.phase);
  const unavailable = state.phase === "provider_unavailable" || (!providerAvailable && state.phase === "idle");

  return (
    <section
      className="rounded-[32px] border border-border bg-paper p-6 shadow-soft sm:p-8"
      aria-label="Provador com foto (experimental)"
      data-testid="tryon-panel"
      data-phase={state.phase}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="eyebrow">Provador com foto</p>
            <Badge variant="amber">Experimental</Badge>
          </div>
          <h2 className="mt-1 text-xl font-medium sm:text-2xl">Veja a peça em uma foto sua</h2>
          <p className="mt-2 max-w-xl text-sm text-stone">
            Geramos uma visualização aproximada da peça no tamanho <span className="font-medium text-ink">{size}</span>
            {size !== recommendedSize ? (
              <>
                {" "}
                (recomendado: <span className="font-medium text-ink">{recommendedSize}</span>)
              </>
            ) : null}
            . {TRYON_COPY.sizeNote}
          </p>
        </div>
        <Camera className="size-5 text-terracotta" aria-hidden="true" />
      </div>

      {!productSupported ? (
        <p className="mt-5 rounded-2xl bg-ivory p-4 text-sm text-stone" role="status">
          {TRYON_COPY.unsupportedProduct}
        </p>
      ) : unavailable ? (
        <div className="mt-5 flex items-start gap-3 rounded-2xl bg-amber/10 p-4 text-sm text-ink-2" role="status">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[#8a6a22]" aria-hidden="true" />
          <div className="flex-1">
            <p>{TRYON_COPY.provider_unavailable}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={props.onReset}>
              <RotateCcw /> Tentar novamente
            </Button>
          </div>
        </div>
      ) : state.phase === "idle" ? (
        <div className="mt-5">
          <Button onClick={props.onOpen} data-testid="tryon-open">
            <Sparkles /> {TRYON_COPY.idle}
          </Button>
        </div>
      ) : null}

      {productSupported && !unavailable && showForm ? (
        <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_320px]">
          <div
            onClick={() => !preview && inputRef.current?.click()}
            className={cn(
              "relative flex min-h-[260px] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-3xl border-2 border-dashed border-border bg-ivory p-6 text-center transition-colors hover:border-ink/40",
              preview && "cursor-default border-solid",
            )}
          >
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              data-testid="tryon-file"
              onChange={(e) => props.onPickFile(e.target.files?.[0] ?? null)}
            />
            {preview ? (
              <div className="relative w-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={preview} alt="Pré-visualização da sua foto" className="mx-auto max-h-[360px] rounded-2xl object-contain" />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    props.onPickFile(null);
                  }}
                  className="absolute right-3 top-3 rounded-full bg-ink/80 p-2 text-ivory backdrop-blur"
                  aria-label="Remover foto"
                >
                  <X className="size-4" />
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-paper">
                  <ImagePlus className="size-5 text-stone" />
                </span>
                <p className="font-medium">Selecione uma foto frontal, de corpo inteiro</p>
                <p className="text-sm text-stone">JPG, PNG ou WebP até 8 MB · fundo neutro e boa iluminação</p>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border bg-ivory p-4 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 size-4 accent-[var(--terracotta)]"
                checked={state.consent}
                onChange={(e) => props.onConsentChange(e.target.checked)}
                data-testid="tryon-consent"
              />
              <span>
                <span className="font-medium">Autorizo o processamento desta foto</span> para gerar a visualização. A
                imagem é usada apenas nesta geração, não é armazenada e o resultado expira automaticamente.
              </span>
            </label>
            {state.message ? (
              <p
                role={state.phase === "failed" || state.phase === "expired" ? "alert" : "status"}
                className={cn(
                  "rounded-xl px-4 py-3 text-sm",
                  state.phase === "failed" || state.phase === "expired" ? "bg-clay/10 text-clay" : "bg-amber/10 text-[#8a6a22]",
                )}
                data-testid="tryon-message"
              >
                {state.message}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button onClick={props.onSubmit} disabled={!state.consent || !state.file} data-testid="tryon-submit">
                <Sparkles /> {state.phase === "consent_required" ? "Gerar visualização" : "Gerar novamente"}
              </Button>
              <Button variant="ghost" onClick={props.onReset}>
                Cancelar
              </Button>
            </div>
            <div className="flex gap-2 text-[12.5px] leading-relaxed text-stone">
              <ShieldCheck className="mt-0.5 size-4 shrink-0" />
              <p>Consentimento específico para esta visualização, independente da análise corporal. Sem reconhecimento facial.</p>
            </div>
          </div>
        </div>
      ) : null}

      {busy ? (
        <div className="mt-5 flex items-center gap-4 rounded-2xl bg-ivory p-5" role="status" aria-live="polite" data-testid="tryon-busy">
          <span className="relative flex size-10 shrink-0 items-center justify-center">
            <span className="absolute inset-0 animate-ping rounded-full bg-terracotta/30" />
            <span className="relative size-4 rounded-full bg-terracotta" />
          </span>
          <div>
            <p className="font-medium">{state.phase === "uploading" ? TRYON_COPY.uploading : TRYON_COPY.processing}</p>
            <p className="text-xs text-stone">
              {state.phase === "uploading" ? "Sua foto está sendo enviada com segurança." : "Isso pode levar cerca de um minuto. Sua recomendação de tamanho já está pronta acima."}
            </p>
          </div>
        </div>
      ) : null}

      {state.phase === "completed" && state.job ? (
        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]" data-testid="tryon-result">
          <div className="overflow-hidden rounded-3xl border border-border bg-ivory">
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageUrl}
                alt={`Visualização gerada por IA da peça no tamanho ${state.job.size}`}
                className="mx-auto max-h-[640px] w-full object-contain"
                onError={props.onImageError}
              />
            ) : null}
          </div>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="amber">Experimental</Badge>
              <Badge variant="outline">Tamanho {state.job.size}</Badge>
              {state.job.cached ? <Badge variant="slate">Resultado reaproveitado</Badge> : null}
              {state.job.duration_ms != null && !state.job.cached ? (
                <Badge variant="outline">{Math.round(state.job.duration_ms / 1000)} s</Badge>
              ) : null}
            </div>
            <div className="flex gap-2 rounded-2xl bg-amber/10 p-4 text-sm text-ink-2">
              <Info className="mt-0.5 size-4 shrink-0 text-[#8a6a22]" />
              <div className="space-y-1">
                <p className="font-medium">{TRYON_COPY.disclaimer}</p>
                <p className="text-stone">{TRYON_COPY.sizeNote}</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={props.onReset}>
              <RotateCcw /> Gerar outra visualização
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
