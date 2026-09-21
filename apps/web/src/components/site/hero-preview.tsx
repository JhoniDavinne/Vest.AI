"use client";

import * as React from "react";
import { motion } from "framer-motion";
import type { RecommendationResponse } from "@veste-ai/contracts";
import { REGION_LABEL, REGION_STATUS_LABEL } from "@veste-ai/contracts";
import { api } from "@/lib/api";
import { formatScore } from "@/lib/utils";
import { ScoreRing } from "@/components/fit/score-ring";
import { STATUS_COLOR } from "@/components/fit/region-grid";
import { ConfidenceBadge } from "@/components/fit/confidence-badge";

const DEMO = { height: 180, weight: 78, chest: 102, waist: 88, hip: 100, shoulder: 45 };

/** Card do hero alimentado pelo motor real (persist=false). */
export function HeroPreview() {
  const [result, setResult] = React.useState<RecommendationResponse | null>(null);
  const [offline, setOffline] = React.useState(false);

  React.useEffect(() => {
    api
      .recommend({ sku: "CAMISETA-001-M", customer: DEMO, fit_preference: "regular", persist: false, channel: "web" })
      .then(setResult)
      .catch(() => setOffline(true));
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 24, rotate: -1 }}
      animate={{ opacity: 1, y: 0, rotate: 0 }}
      transition={{ duration: 0.8, ease: [0.2, 0.8, 0.2, 1], delay: 0.2 }}
      className="relative"
    >
      <div className="absolute -inset-6 -z-10 rounded-[40px] bg-gradient-to-br from-terracotta/15 via-transparent to-sage/15 blur-2xl" />
      <div className="rounded-[28px] border border-border bg-paper p-6 shadow-lift sm:p-7">
        <div className="flex items-start justify-between">
          <div>
            <p className="eyebrow">Camiseta Essential Algodão</p>
            <p className="mt-1 text-sm text-stone">Atelier Norte · Modelagem regular</p>
          </div>
          {result ? <ConfidenceBadge confidence={result.confidence} /> : null}
        </div>

        <div className="mt-6 flex items-center gap-6">
          <ScoreRing score={result?.fit_score ?? 0} size={132} stroke={9} />
          <div className="space-y-2">
            <p className="text-sm text-stone">Tamanho recomendado</p>
            <p className="font-display text-6xl font-medium leading-none">{result?.recommended_size ?? "—"}</p>
            <p className="text-sm text-stone">
              {result ? result.scale_label : offline ? "API indisponível — inicie o backend" : "Consultando o motor…"}
            </p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-5 gap-1">
          {(result?.regions ?? []).map((r) => (
            <div
              key={r.region}
              className="min-w-0 rounded-lg border-2 bg-ivory px-1 py-1.5 text-center"
              style={{ borderColor: STATUS_COLOR[r.status] }}
            >
              <p className="text-[9px] uppercase tracking-wide text-stone leading-none">{REGION_LABEL[r.region]}</p>
              <p className="mt-1 text-[9px] font-medium leading-[1.15]">{REGION_STATUS_LABEL[r.status]}</p>
            </div>
          ))}
        </div>

        {result ? (
          <div className="mt-5 flex gap-2">
            {result.comparison.map((c) => (
              <div
                key={c.sku}
                className={`flex-1 rounded-xl border px-2 py-2 text-center ${c.recommended ? "border-ink bg-ink text-ivory" : "border-border"}`}
              >
                <p className="font-display text-base">{c.size}</p>
                <p className={`text-xs ${c.recommended ? "text-ivory/70" : "text-stone"}`}>{formatScore(c.fit_score)}</p>
              </div>
            ))}
          </div>
        ) : null}
        <p className="mt-5 text-[11px] text-stone">
          Resultado calculado em tempo real pelo motor VESTE.AI para um perfil de demonstração (180 cm · 102 · 88 · 100 · 45).
        </p>
      </div>
    </motion.div>
  );
}
