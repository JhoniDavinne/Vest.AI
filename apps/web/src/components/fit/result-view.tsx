"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Braces, ChevronRight, Info, MessageSquareHeart, Sparkles } from "lucide-react";
import type { Product, RecommendationResponse } from "@veste-ai/contracts";
import { FIT_PREFERENCE_LABEL, MODELING_LABEL } from "@veste-ai/contracts";
import { api, ApiError } from "@/lib/api";
import { useProfile } from "@/lib/profile";
import { cn, formatScore } from "@/lib/utils";
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

export function ResultView({ analysisId }: { analysisId: string }) {
  const { user } = useProfile();
  const [base, setBase] = React.useState<RecommendationResponse | null>(null);
  const [current, setCurrent] = React.useState<RecommendationResponse | null>(null);
  const [product, setProduct] = React.useState<Product | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loadingSize, setLoadingSize] = React.useState<string | null>(null);
  const [showJson, setShowJson] = React.useState(false);
  const [feedbackSent, setFeedbackSent] = React.useState<string | null>(null);

  React.useEffect(() => {
    api
      .getRecommendation(analysisId)
      .then(async (r) => {
        setBase(r);
        setCurrent(r);
        setProduct(await api.getProduct(r.product_id));
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Não foi possível carregar a análise."));
  }, [analysisId]);

  async function evaluate(size: string) {
    if (!base || !current) return;
    if (size === current.evaluated_size) return;
    const target = base.comparison.find((c) => c.size === size);
    if (!target) return;
    setLoadingSize(size);
    try {
      const snapshot = base;
      const result = await api.recommend({
        sku: target.sku,
        user_id: user?.id,
        customer: user
          ? undefined
          : Object.fromEntries(snapshot.regions.filter((r) => r.body != null).map((r) => [r.region, r.body])),
        fit_preference: undefined,
        channel: "web",
        persist: false,
        use_photo: snapshot.visual_used,
      });
      setCurrent(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Falha ao avaliar o tamanho.");
    } finally {
      setLoadingSize(null);
    }
  }

  async function sendFeedback(rating: "too_tight" | "good" | "too_loose") {
    if (!base?.analysis_id) return;
    try {
      await api.feedback({ analysis_id: base.analysis_id, fit_rating: rating, followed_recommendation: true });
      setFeedbackSent(rating);
    } catch (err) {
      setFeedbackSent(err instanceof ApiError && err.status === 422 ? "dup" : "err");
    }
  }

  if (error) {
    return (
      <div className="container-veste py-20">
        <div className="rounded-3xl border border-border bg-paper p-10 text-center">
          <p className="font-medium">{error}</p>
          <Button asChild variant="outline" className="mt-4">
            <Link href="/catalogo">Voltar ao catálogo</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!current || !base) {
    return (
      <div className="container-veste space-y-6 py-16">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <Skeleton className="h-[420px] rounded-3xl" />
          <Skeleton className="h-[420px] rounded-3xl" />
        </div>
      </div>
    );
  }

  const isRecommended = current.evaluated_size === current.recommended_size;

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

      {/* HERO DO RESULTADO */}
      <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-[32px] border border-border bg-paper p-7 shadow-lift sm:p-10"
        >
          <div className="grain absolute inset-0 -z-10" />
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{product?.brand}</Badge>
            {product ? <Badge variant="secondary">{MODELING_LABEL[product.modeling]}</Badge> : null}
            <ConfidenceBadge confidence={current.confidence} />
            {current.visual_used ? <Badge variant="slate">Análise visual experimental</Badge> : null}
          </div>

          <div className="mt-8 grid items-center gap-8 sm:grid-cols-[auto_1fr]">
            <div className="flex flex-col items-center gap-3">
              <motion.div
                key={current.recommended_size}
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex size-36 items-center justify-center rounded-[36px] bg-ink text-ivory shadow-lift"
              >
                <span className="font-display text-7xl font-medium">{current.recommended_size}</span>
              </motion.div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-stone">Tamanho recomendado</p>
            </div>
            <div className="space-y-4">
              <div className="flex items-center gap-6">
                <ScoreRing score={current.fit_score} size={120} stroke={9} />
                <div>
                  <p className="eyebrow">Score de caimento</p>
                  <p className="mt-1 font-display text-4xl">
                    {formatScore(current.fit_score)} <span className="text-xl text-stone">/ 10</span>
                  </p>
                  <p className="mt-1 text-sm font-medium">{current.scale_label}</p>
                  <p className="text-xs text-stone">
                    {isRecommended ? "Tamanho avaliado: " : "Você está vendo o tamanho "}
                    <span className="font-medium text-ink">{current.evaluated_size}</span>
                  </p>
                </div>
              </div>
              <p className="text-[15px] leading-relaxed text-ink-2">{current.scale_message}</p>
            </div>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl bg-ivory p-5">
              <p className="eyebrow">Explicação</p>
              <p className="mt-2 text-sm leading-relaxed text-ink-2">{current.explanation}</p>
            </div>
            <div className="rounded-2xl bg-ivory p-5">
              <p className="eyebrow">Recomendação</p>
              <p className="mt-2 text-sm leading-relaxed text-ink-2">{current.recommendation}</p>
              <p className="mt-3 text-xs text-stone">{current.confidence_message}</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex flex-col rounded-[32px] border border-border bg-paper p-7 shadow-soft"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="eyebrow">Comparação entre tamanhos</p>
              <p className="mt-1 text-sm text-stone">Selecione para ver como o score muda.</p>
            </div>
            <Sparkles className="size-4 text-terracotta" />
          </div>
          <div className="mt-5 flex-1">
            <SizeComparisonBars
              comparison={base.comparison}
              selectedSize={current.evaluated_size}
              onSelect={evaluate}
              loadingSize={loadingSize}
            />
          </div>
          <p className="mt-4 text-xs text-stone">
            Os valores são recalculados pelo motor para cada tamanho — a comparação demonstra que a compatibilidade é
            realmente computada, não fixa.
          </p>
        </motion.div>
      </section>

      {/* REGIOES */}
      <section className="space-y-4">
        <div className="flex items-end justify-between">
          <div>
            <p className="eyebrow">Análise por região · tamanho {current.evaluated_size}</p>
            <h2 className="mt-1 text-2xl font-medium">Onde a peça tende a ajustar melhor</h2>
          </div>
          <div className="hidden gap-4 text-xs text-stone sm:flex">
            <Legend color="var(--sage)" label="Compatível" />
            <Legend color="var(--amber)" label="Atenção" />
            <Legend color="var(--clay)" label="Folga recomendada" />
          </div>
        </div>
        <AnimatePresence mode="wait">
          <motion.div key={current.evaluated_sku} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <RegionGrid regions={current.regions} />
          </motion.div>
        </AnimatePresence>
      </section>

      {/* COMO CALCULAMOS */}
      <section className="rounded-[32px] border border-border bg-paper p-7 shadow-soft sm:p-10">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-xl">
            <p className="eyebrow">Como calculamos?</p>
            <h2 className="mt-1 text-2xl font-medium">Cinco componentes, um score explicável.</h2>
            <p className="mt-2 text-sm text-stone">
              Valores normalizados (0–10) de cada componente para o tamanho {current.evaluated_size}. Pesos oficiais do MVP;
              sem foto, o peso das proporções é redistribuído.
            </p>
          </div>
          <div className="text-sm text-stone">
            Preferência declarada:{" "}
            <span className="font-medium text-ink">{user ? FIT_PREFERENCE_LABEL[user.fit_preference] : "Regular"}</span>
          </div>
        </div>
        <WeightsBar className="mt-6" weights={current.weights} />
        <div className="mt-6">
          <ComponentBreakdown components={current.components} weights={current.weights} />
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          {current.notes.map((n) => (
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
          </p>
          <JsonViewer data={current} maxHeight={520} />
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
