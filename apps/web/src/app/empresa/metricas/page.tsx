"use client";

import * as React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Metrics } from "@veste-ai/contracts";
import { CATEGORY_LABEL, type Category } from "@veste-ai/contracts";
import { api } from "@/lib/api";
import { formatPercent, formatScore } from "@/lib/utils";
import { StudioHeader, StatCard } from "@/components/studio/studio-shell";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/misc";

const CHART_INK = "#141416";
const CHART_STONE = "#6f6b66";
const CHART_TERRACOTTA = "#c4623a";
const CHART_SAGE = "#5f7f6a";
const CHART_AMBER = "#c99a3b";
const CHART_CLAY = "#b4553f";
const PIE_COLORS = [CHART_TERRACOTTA, CHART_SAGE, CHART_AMBER, CHART_CLAY, "#8a96a3", "#2a2a2e"];

function categoryLabel(key: string): string {
  if (key in CATEGORY_LABEL) return CATEGORY_LABEL[key as Category];
  return key;
}

export default function StudioMetricsPage() {
  const [metrics, setMetrics] = React.useState<Metrics | null>(null);
  const [error, setError] = React.useState(false);

  React.useEffect(() => {
    api
      .metrics()
      .then(setMetrics)
      .catch(() => setError(true));
  }, []);

  const sizeData = metrics
    ? Object.entries(metrics.size_distribution).map(([size, count]) => ({ size, count }))
    : [];
  const confidenceData = metrics
    ? Object.entries(metrics.confidence_distribution).map(([name, value]) => ({
        name: name === "high" ? "Alta" : name === "medium" ? "Média" : name === "low" ? "Baixa" : name,
        value,
      }))
    : [];
  const channelData = metrics
    ? Object.entries(metrics.channel_distribution).map(([name, value]) => ({ name, value }))
    : [];
  const categoryData = metrics
    ? metrics.category_distribution.map((row) => ({
        category: categoryLabel(row.category),
        analyses: row.analyses,
        avg_score: row.avg_score,
      }))
    : [];

  const reduction = metrics?.return_reduction_potential ?? {};

  return (
    <>
      <StudioHeader
        eyebrow="Indicadores"
        title="Métricas"
        description="Indicadores calculados com Pandas sobre análises geradas pelo próprio motor em perfis sintéticos. Não são dados reais de mercado."
        actions={metrics ? <Badge variant="amber">{metrics.disclaimer}</Badge> : undefined}
      />

      {error ? (
        <div className="rounded-2xl border border-dashed border-border bg-paper p-8 text-center text-sm text-stone">
          API indisponível. Inicie o backend para carregar as métricas.
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics ? (
          <>
            <StatCard label="Análises realizadas" value={metrics.total_analyses} hint="Seed + chamadas da demo" />
            <StatCard
              label="Taxa de recomendação"
              value={formatPercent(metrics.recommendation_rate)}
              hint="Score ≥ 7,0"
            />
            <StatCard label="Tamanho mais recomendado" value={metrics.most_recommended_size ?? "—"} />
            <StatCard
              label="Score médio"
              value={formatScore(metrics.average_score)}
              hint={`Confiança média ${formatPercent(metrics.average_confidence)}`}
            />
          </>
        ) : (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)
        )}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <ChartCard title="Série diária" hint="Análises e score médio (últimos 30 dias do seed)">
          {metrics ? (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={metrics.daily_series}>
                <CartesianGrid stroke="#e9e5df" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: CHART_STONE, fontSize: 11 }} tickFormatter={(v) => String(v).slice(5)} />
                <YAxis yAxisId="left" tick={{ fill: CHART_STONE, fontSize: 11 }} />
                <YAxis yAxisId="right" orientation="right" domain={[0, 10]} tick={{ fill: CHART_STONE, fontSize: 11 }} />
                <Tooltip />
                <Line yAxisId="left" type="monotone" dataKey="analyses" stroke={CHART_INK} strokeWidth={2} dot={false} name="Análises" />
                <Line yAxisId="right" type="monotone" dataKey="avg_score" stroke={CHART_TERRACOTTA} strokeWidth={2} dot={false} name="Score médio" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <Skeleton className="h-[260px]" />
          )}
        </ChartCard>

        <ChartCard title="Distribuição de tamanhos" hint="Tamanho recomendado pelo motor">
          {metrics ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={sizeData}>
                <CartesianGrid stroke="#e9e5df" vertical={false} />
                <XAxis dataKey="size" tick={{ fill: CHART_STONE, fontSize: 11 }} />
                <YAxis tick={{ fill: CHART_STONE, fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill={CHART_INK} radius={[6, 6, 0, 0]} name="Recomendações" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <Skeleton className="h-[260px]" />
          )}
        </ChartCard>

        <ChartCard title="Faixas de score" hint="Escala oficial do MVP">
          {metrics ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={metrics.score_distribution}>
                <CartesianGrid stroke="#e9e5df" vertical={false} />
                <XAxis dataKey="range" tick={{ fill: CHART_STONE, fontSize: 11 }} />
                <YAxis tick={{ fill: CHART_STONE, fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" radius={[6, 6, 0, 0]} name="Análises">
                  {metrics.score_distribution.map((row) => {
                    const color =
                      row.range === "8.5-10"
                        ? CHART_SAGE
                        : row.range === "7.0-8.4"
                          ? "#7C9A6A"
                          : row.range === "5.0-6.9"
                            ? CHART_AMBER
                            : CHART_CLAY;
                    return <Cell key={row.range} fill={color} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <Skeleton className="h-[260px]" />
          )}
        </ChartCard>

        <ChartCard title="Confiança" hint="Alta / média / baixa">
          {metrics ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={confidenceData} dataKey="value" nameKey="name" innerRadius={58} outerRadius={90} paddingAngle={3}>
                  {confidenceData.map((entry, i) => (
                    <Cell key={entry.name} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <Skeleton className="h-[260px]" />
          )}
        </ChartCard>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <ChartCard title="Por categoria" hint="Volume e score médio">
          {metrics ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={categoryData} layout="vertical" margin={{ left: 16 }}>
                <CartesianGrid stroke="#e9e5df" horizontal={false} />
                <XAxis type="number" tick={{ fill: CHART_STONE, fontSize: 11 }} />
                <YAxis type="category" dataKey="category" width={88} tick={{ fill: CHART_STONE, fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="analyses" fill={CHART_INK} radius={[0, 6, 6, 0]} name="Análises" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <Skeleton className="h-[280px]" />
          )}
        </ChartCard>

        <section className="rounded-3xl border border-border bg-paper p-6 shadow-soft">
          <p className="eyebrow">Valor para o parceiro</p>
          <h2 className="mt-1 text-xl font-medium">Potencial de redução de devoluções</h2>
          {metrics ? (
            <div className="mt-5 space-y-4">
              <Mini label="Linha de base ilustrativa" value={formatPercent(Number(reduction.baseline_return_rate ?? 0))} />
              <Mini
                label="Devolução seguindo a recomendação"
                value={formatPercent(Number(reduction.return_rate_with_recommendation ?? 0))}
              />
              <Mini
                label="Redução relativa hipotética"
                value={formatPercent(Number(reduction.relative_reduction ?? 0))}
                accent
              />
              <p className="text-xs leading-relaxed text-stone">{reduction.note}</p>
              <div className="grid grid-cols-3 gap-2 pt-2">
                {channelData.map((row) => (
                  <div key={row.name} className="rounded-2xl bg-ivory p-3">
                    <p className="text-[10.5px] uppercase tracking-[0.14em] text-stone">{row.name}</p>
                    <p className="mt-1 font-display text-2xl">{row.value}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <Skeleton className="mt-5 h-56" />
          )}
        </section>
      </div>
    </>
  );
}

function ChartCard({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-border bg-paper p-6 shadow-soft">
      <h2 className="text-lg font-medium">{title}</h2>
      {hint ? <p className="mt-1 text-xs text-stone">{hint}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Mini({ label, value, accent }: { label: string; value: React.ReactNode; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-ivory px-4 py-3">
      <p className="text-sm text-stone">{label}</p>
      <p className="font-display text-2xl" style={accent ? { color: CHART_TERRACOTTA } : undefined}>
        {value}
      </p>
    </div>
  );
}
