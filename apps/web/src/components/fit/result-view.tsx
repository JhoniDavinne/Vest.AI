"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, Braces, ChevronRight, Info, MessageSquareHeart, RotateCcw, Sparkles, X } from "lucide-react";
import type { Product, RecommendationResponse } from "@veste-ai/contracts";
import { FIT_PREFERENCE_LABEL, MODELING_LABEL } from "@veste-ai/contracts";
import { api, ApiError } from "@/lib/api";
import { useProfile } from "@/lib/profile";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/misc";
import { ScoreRing } from "./score-ring";
import { RegionGrid } from "./region-grid";
import { SizeComparisonBars } from "./size-comparison";
import { ComponentBreakdown, WeightsBar } from "./how-we-calculate";
import { ConfidenceBadge } from "./confidence-badge";
import { JsonViewer } from "./json-viewer";
import { FitPreview3DLazy } from "./fit-preview-3d-lazy";
import {
  buildPreviewPayloadFromRecommendation,
  FitLegend,
  fitStateToRegionDetails,
  listSizeOptions,
  mergeFitPreviewPayload,
} from "@veste-ai/fit-preview-3d";
import { resolvePreviewSelection } from "@/lib/fit-preview";

/**
 * Tela de resultado.
 *
 * - `base`: analise original (recomendacao do motor). Nunca e sobrescrita.
 * - `previewSize`: tamanho visualizado no provador (recommendedSize x selectedPreviewSize).
 * - Estado visual do tamanho selecionado vem de `base.comparison[].regions` (dados do motor,
 *   sem nova chamada). Se a resposta nao trouxer `regions` para o tamanho, ou quando o
 *   usuario pedir a explicacao textual daquele tamanho, consulta a API com `persist:false`.
 *
 * Layout: desktop em duas colunas (provador a esquerda; recomendacao + regioes a direita);
 * mobile em coluna unica na ordem recomendacao → provador/seletor → regioes → explicacoes.
 */
export function ResultView({ analysisId }: { analysisId: string }) {
  const { user } = useProfile();
  const reducedMotion = useReducedMotion();
  const [base, setBase] = React.useState<RecommendationResponse | null>(null);
  const [product, setProduct] = React.useState<Product | null>(null);
  const [previewSize, setPreviewSize] = React.useState<string | null>(null);
  const [detailBySize, setDetailBySize] = React.useState<Record<string, RecommendationResponse>>({});
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [sizeError, setSizeError] = React.useState<string | null>(null);
  const [loadingSize, setLoadingSize] = React.useState<string | null>(null);
  const [showJson, setShowJson] = React.useState(false);
  const [feedbackSent, setFeedbackSent] = React.useState<string | null>(null);

  React.useEffect(() => {
    api
      .getRecommendation(analysisId)
      .then(async (r) => {
        setBase(r);
        setPreviewSize(r.evaluated_size);
        setDetailBySize({ [r.evaluated_size]: r });
        setProduct(await api.getProduct(r.product_id));
      })
      .catch((err) => setLoadError(err instanceof ApiError ? err.message : "Não foi possível carregar a análise."));
  }, [analysisId]);

  // Estado visual do tamanho selecionado: comparison (sem HTTP) -> resposta detalhada -> null.
  const selection = React.useMemo(
    () => (base ? resolvePreviewSelection(base, previewSize, detailBySize) : null),
    [base, previewSize, detailBySize],
  );
  const selectedSize = selection?.selectedPreviewSize ?? null;
  const detail = selectedSize ? detailBySize[selectedSize] : undefined;
  const fitState = selection?.fit ?? null;

  const sizeOptions = React.useMemo(() => (base ? listSizeOptions(base) : []), [base]);

  const previewPayload = React.useMemo(() => {
    if (!base || !product) return null;
    const fallback = buildPreviewPayloadFromRecommendation(base, product, {
      body: user?.measurements ?? undefined,
      photo: user?.photo_analysis,
      garmentMeasurements: product.sizes.find((s) => s.size_label === base.evaluated_size)?.measurements,
    });
    return mergeFitPreviewPayload(base, fallback);
  }, [base, product, user]);

  const fetchDetail = React.useCallback(
    async (size: string, snapshot: RecommendationResponse) => {
      const target = snapshot.comparison.find((c) => c.size === size);
      if (!target) return;
      setLoadingSize(size);
      setSizeError(null);
      try {
        // Preferencia: recalcular a partir do snapshot persistido da analise (mesmas medidas,
        // altura e peso inclusos) -> resultado identico ao comparison. Fallback (analise nao
        // persistida): medidas do fit_preview/regions com persist:false.
        const result = snapshot.analysis_id
          ? await api.getRecommendation(snapshot.analysis_id, size)
          : await api.recommend({
              sku: target.sku,
              user_id: user?.id,
              customer: user
                ? undefined
                : {
                    height: snapshot.fit_preview?.body.height ?? undefined,
                    ...Object.fromEntries(snapshot.regions.filter((r) => r.body != null).map((r) => [r.region, r.body])),
                  },
              fit_preference: undefined,
              channel: "web",
              persist: false,
              use_photo: snapshot.visual_used,
            });
        setDetailBySize((prev) => ({ ...prev, [size]: result }));
      } catch (err) {
        setSizeError(
          err instanceof ApiError
            ? `Não foi possível obter o tamanho ${size}: ${err.message}`
            : `Não foi possível obter o tamanho ${size}. A recomendação original permanece válida.`,
        );
      } finally {
        setLoadingSize(null);
      }
    },
    [user],
  );

  const selectSize = React.useCallback(
    (size: string) => {
      if (!base || size === selectedSize) return;
      setPreviewSize(size);
      setSizeError(null);
      // Sem `regions` no comparison (resposta antiga/incompleta) a API e a unica fonte.
      if (resolvePreviewSelection(base, size, detailBySize).needsEngineFetch) {
        void fetchDetail(size, base);
      }
    },
    [base, selectedSize, detailBySize, fetchDetail],
  );

  async function sendFeedback(rating: "too_tight" | "good" | "too_loose") {
    if (!base?.analysis_id) return;
    try {
      await api.feedback({ analysis_id: base.analysis_id, fit_rating: rating, followed_recommendation: true });
      setFeedbackSent(rating);
    } catch (err) {
      setFeedbackSent(err instanceof ApiError && err.status === 422 ? "dup" : "err");
    }
  }

  if (loadError && !base) {
    return (
      <div className="container-veste py-20">
        <div className="rounded-3xl border border-border bg-paper p-10 text-center">
          <p className="font-medium">{loadError}</p>
          <Button asChild variant="outline" className="mt-4">
            <Link href="/catalogo">Voltar ao catálogo</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!base || !selectedSize) {
    return (
      <div className="container-veste space-y-6 py-16" aria-busy="true" aria-label="Preparando provador">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <Skeleton className="h-[460px] rounded-[32px]" />
          <div className="space-y-6">
            <Skeleton className="h-[220px] rounded-[32px]" />
            <Skeleton className="h-[220px] rounded-[32px]" />
          </div>
        </div>
        <p className="text-center text-sm text-stone">Preparando provador…</p>
      </div>
    );
  }

  const recommendedSize = base.recommended_size;
  const isRecommended = selectedSize === recommendedSize;
  const comparisonEntry = base.comparison.find((c) => c.size === selectedSize);
  const displayScore = fitState?.fitScore ?? detail?.fit_score ?? comparisonEntry?.fit_score ?? base.fit_score;
  const displayRegions = fitState ? fitStateToRegionDetails(fitState) : detail?.regions ?? [];
  const displayComponents = detail?.components ?? comparisonEntry?.components ?? base.components;
  // Textos do motor sao por tamanho avaliado: so exibimos os do tamanho selecionado.
  const textSource = detail ?? (selectedSize === base.evaluated_size ? base : null);
  const scaleLabel = detail?.scale_label ?? (selectedSize === base.evaluated_size ? base.scale_label : null);
  const jsonSource = detail ?? base;
  const isUpdating = loadingSize === selectedSize;
  const fade = reducedMotion ? {} : { initial: { opacity: 0, y: 6 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -4 } };

  return (
    <div className="container-veste space-y-10 pb-24 pt-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link href={product ? `/catalogo/${product.slug}` : "/catalogo"} className="inline-flex items-center gap-2 text-sm text-stone hover:text-ink">
          <ArrowLeft className="size-4" /> {product ? product.name : "Catálogo"}
        </Link>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowJson(true)}>
            <Braces /> Ver JSON da API
          </Button>
          <Button asChild size="sm" variant="ghost">
            <Link href="/como-calculamos">
              Como calculamos <ChevronRight />
            </Link>
          </Button>
        </div>
      </div>

      {/* PROVADOR + RECOMENDACAO */}
      <section
        className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)] lg:grid-rows-[auto_1fr]"
        aria-label="Provador virtual e recomendação"
      >
        {/* 1. Recomendacao (mobile: topo · desktop: coluna direita) */}
        <motion.aside
          initial={reducedMotion ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-[32px] border border-border bg-paper p-6 shadow-lift sm:p-8 lg:col-start-2 lg:row-start-1"
          aria-label="Recomendação do motor"
        >
          <div className="grain absolute inset-0 -z-10" />
          <div className="flex flex-wrap items-center gap-2">
            {product ? <Badge variant="outline">{product.brand}</Badge> : null}
            {product ? <Badge variant="secondary">{MODELING_LABEL[product.modeling]}</Badge> : null}
            {base.visual_used ? <Badge variant="slate">Análise visual experimental</Badge> : null}
          </div>

          <div className="mt-6 flex items-center gap-5">
            <div className="flex size-24 shrink-0 items-center justify-center rounded-[28px] bg-ink text-ivory shadow-lift sm:size-28">
              <span className="font-display text-5xl font-medium sm:text-6xl">{recommendedSize}</span>
            </div>
            <div className="min-w-0">
              <p className="eyebrow">Tamanho recomendado</p>
              <p className="mt-1 text-sm leading-relaxed text-ink-2">
                Melhor equilíbrio entre as regiões analisadas pelo motor.
              </p>
              <ConfidenceBadge confidence={base.confidence} className="mt-3" />
            </div>
          </div>

          {/* Recomendado x visualizado */}
          <AnimatePresence initial={false}>
            {!isRecommended ? (
              <motion.div
                key="viewing-other"
                {...fade}
                className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-terracotta/30 bg-terracotta/[0.06] px-4 py-3"
                role="status"
              >
                <p className="text-sm">
                  <span className="font-medium">Visualizando tamanho {selectedSize}</span>
                  <span className="text-stone"> · Recomendado: {recommendedSize}</span>
                </p>
                <Button variant="outline" size="sm" onClick={() => selectSize(recommendedSize)} data-testid="back-to-recommended">
                  <RotateCcw /> Voltar ao recomendado
                </Button>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <div className="mt-6 flex items-center gap-5 border-t border-border pt-6">
            <ScoreRing score={displayScore} size={104} stroke={8} />
            <div className="min-w-0">
              <p className="eyebrow whitespace-nowrap">Caimento · tamanho {selectedSize}</p>
              <AnimatePresence mode="wait" initial={false}>
                <motion.p key={`${selectedSize}-${scaleLabel ?? "sem-rotulo"}`} {...fade} className="mt-1 text-base font-medium leading-snug">
                  {scaleLabel ?? "Calculado pelo motor"}
                </motion.p>
              </AnimatePresence>
              <p className="mt-1 text-xs text-stone">
                {isUpdating ? "Atualizando tamanho…" : textSource?.confidence_message ?? base.confidence_message}
              </p>
            </div>
          </div>
        </motion.aside>

        {/* 2. Provador 3D (mobile: apos a recomendacao · desktop: coluna esquerda, ocupa as duas linhas) */}
        <motion.div
          initial={reducedMotion ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="min-w-0 rounded-[32px] border border-border bg-paper p-4 shadow-soft sm:p-6 lg:col-start-1 lg:row-start-1 lg:row-span-2"
        >
          <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="eyebrow">Provador virtual</p>
              <h2 className="mt-1 text-xl font-medium sm:text-2xl">Avatar com caimento por região</h2>
            </div>
            <Sparkles className="size-4 text-terracotta" aria-hidden="true" />
          </div>

          {previewPayload ? (
            <FitPreview3DLazy
              payload={previewPayload}
              fit={fitState}
              sizes={sizeOptions}
              onSelectSize={selectSize}
              loadingSize={loadingSize}
              size="full"
              showSummary={false}
              showLegend={false}
              regionsFallback={displayRegions}
            />
          ) : (
            <div className="flex min-h-[320px] items-center justify-center rounded-3xl border border-border bg-ivory text-sm text-stone">
              Preparando provador…
            </div>
          )}

          <AnimatePresence initial={false}>
            {sizeError ? (
              <motion.div
                key="size-error"
                {...fade}
                role="alert"
                className="mt-3 flex items-start justify-between gap-3 rounded-2xl bg-clay/10 px-4 py-3 text-sm text-clay"
              >
                <span>{sizeError}</span>
                <button type="button" aria-label="Fechar aviso" className="rounded-full p-1 hover:bg-clay/10" onClick={() => setSizeError(null)}>
                  <X className="size-4" />
                </button>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </motion.div>

        {/* 3. Regioes (mobile: apos o provador · desktop: coluna direita, segunda linha) */}
        <motion.div
          initial={reducedMotion ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-[32px] border border-border bg-paper p-6 shadow-soft sm:p-8 lg:col-start-2 lg:row-start-2"
          aria-label="Caimento por região"
        >
          <div className="flex items-end justify-between gap-2">
            <div>
              <p className="eyebrow">Regiões · tamanho {selectedSize}</p>
              <h3 className="mt-1 text-lg font-medium">Como a peça tende a vestir</h3>
            </div>
          </div>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={`legend-${selectedSize}-${fitState ? "ok" : "none"}`} {...fade} className="mt-4">
              {fitState && fitState.regionList.some((r) => r.status !== "not_evaluated") ? (
                <FitLegend fit={fitState} variant="list" />
              ) : (
                <p className="rounded-2xl bg-ivory p-4 text-sm text-stone">
                  {isUpdating ? "Atualizando tamanho…" : "Sem detalhe regional para este tamanho."}
                </p>
              )}
            </motion.div>
          </AnimatePresence>
          <p className="mt-4 text-xs text-stone">
            Estimativa de compatibilidade entre pessoa e peça — não é uma avaliação do corpo.
          </p>
        </motion.div>
      </section>

      {/* EXPLICACOES */}
      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]" aria-label="Explicação e comparação">
        <div className="rounded-[32px] border border-border bg-paper p-6 shadow-soft sm:p-8">
          <p className="eyebrow">Por que este resultado · tamanho {selectedSize}</p>
          <AnimatePresence mode="wait" initial={false}>
            {textSource ? (
              <motion.div key={`texts-${textSource.evaluated_size}`} {...fade} className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl bg-ivory p-5">
                  <p className="eyebrow">Explicação</p>
                  <p className="mt-2 text-sm leading-relaxed text-ink-2">{textSource.explanation}</p>
                </div>
                <div className="rounded-2xl bg-ivory p-5">
                  <p className="eyebrow">Recomendação</p>
                  <p className="mt-2 text-sm leading-relaxed text-ink-2">{textSource.recommendation}</p>
                  <p className="mt-3 text-xs text-stone">{textSource.scale_message}</p>
                </div>
              </motion.div>
            ) : (
              <motion.div key={`texts-pending-${selectedSize}`} {...fade} className="mt-4 rounded-2xl bg-ivory p-5">
                <p className="text-sm leading-relaxed text-ink-2">
                  Score e regiões já são do motor para o tamanho {selectedSize}. A justificativa textual é gerada por tamanho
                  avaliado — gere-a sob demanda.
                </p>
                <Button size="sm" variant="outline" className="mt-3" disabled={isUpdating} onClick={() => void fetchDetail(selectedSize, base)}>
                  {isUpdating ? "Consultando o motor…" : `Gerar explicação para ${selectedSize}`}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex flex-col rounded-[32px] border border-border bg-paper p-6 shadow-soft sm:p-8">
          <div>
            <p className="eyebrow">Comparação entre tamanhos</p>
            <p className="mt-1 text-sm text-stone">Todos calculados pelo motor na mesma análise.</p>
          </div>
          <div className="mt-5 flex-1">
            <SizeComparisonBars comparison={base.comparison} selectedSize={selectedSize} onSelect={selectSize} loadingSize={loadingSize} />
          </div>
        </div>
      </section>

      {/* DETALHE TECNICO POR REGIAO */}
      {displayRegions.length > 0 ? (
        <section className="space-y-4" aria-label="Detalhe técnico por região">
          <div className="flex items-end justify-between">
            <div>
              <p className="eyebrow">Detalhe técnico · tamanho {selectedSize}</p>
              <h2 className="mt-1 text-2xl font-medium">Folga por região</h2>
            </div>
            <div className="hidden gap-4 text-xs text-stone sm:flex">
              <Legend color="var(--sage)" label="Compatível" />
              <Legend color="var(--amber)" label="Atenção" />
              <Legend color="var(--clay)" label="Folga recomendada" />
            </div>
          </div>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={`grid-${selectedSize}`} {...fade}>
              <RegionGrid regions={displayRegions} />
            </motion.div>
          </AnimatePresence>
        </section>
      ) : null}

      {/* COMO CALCULAMOS */}
      <section className="rounded-[32px] border border-border bg-paper p-7 shadow-soft sm:p-10">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-xl">
            <p className="eyebrow">Como calculamos?</p>
            <h2 className="mt-1 text-2xl font-medium">Cinco componentes, um score explicável.</h2>
            <p className="mt-2 text-sm text-stone">
              Valores normalizados (0–10) de cada componente para o tamanho {selectedSize}. Pesos oficiais do MVP;
              sem foto, o peso das proporções é redistribuído.
            </p>
          </div>
          <div className="text-sm text-stone">
            Preferência declarada:{" "}
            <span className="font-medium text-ink">{user ? FIT_PREFERENCE_LABEL[user.fit_preference] : "Regular"}</span>
          </div>
        </div>
        <WeightsBar className="mt-6" weights={base.weights} />
        <div className="mt-6">
          <ComponentBreakdown components={displayComponents} weights={base.weights} />
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          {base.notes.map((n) => (
            <span key={n} className="inline-flex items-center gap-1.5 rounded-full bg-ivory px-3 py-1 text-[11.5px] text-stone">
              <Info className="size-3" /> {n}
            </span>
          ))}
        </div>
      </section>

      {/* FEEDBACK */}
      <section className="flex flex-col gap-4 rounded-3xl border border-border bg-ivory p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <MessageSquareHeart className="size-5 text-terracotta" />
          <div>
            <p className="font-medium">Já usou a peça? Conte como ficou.</p>
            <p className="text-xs text-stone">O feedback alimenta a evolução do motor (histórico de caimento, trocas e devoluções).</p>
          </div>
        </div>
        {feedbackSent ? (
          <p className="text-sm text-sage">
            {feedbackSent === "dup" ? "Esta análise já possui feedback." : feedbackSent === "err" ? "Não foi possível registrar." : "Obrigado! Feedback registrado."}
          </p>
        ) : (
          <div className="flex gap-2">
            {(["too_tight", "good", "too_loose"] as const).map((r) => (
              <Button key={r} size="sm" variant={r === "good" ? "default" : "outline"} onClick={() => sendFeedback(r)}>
                {r === "too_tight" ? "Ficou justo" : r === "good" ? "Ficou bom" : "Ficou largo"}
              </Button>
            ))}
          </div>
        )}
      </section>

      <Dialog open={showJson} onOpenChange={setShowJson}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Resposta real da API</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-stone">
            <code className="font-mono text-xs">POST /api/v1/recommendations</code> — o mesmo JSON consumido pela aplicação, pela API B2B e pelo widget.
            {jsonSource !== base ? ` Exibindo a avaliação do tamanho ${jsonSource.evaluated_size}.` : null}
          </p>
          <JsonViewer data={jsonSource} maxHeight={520} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5")}>
      <span className="size-2.5 rounded-full" style={{ background: color }} /> {label}
    </span>
  );
}
