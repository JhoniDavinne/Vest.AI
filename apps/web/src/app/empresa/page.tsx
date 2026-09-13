"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, BarChart3, Boxes, Code2, Puzzle, ServerCog } from "lucide-react";
import type { CompanyDashboard, HealthResponse, Metrics } from "@veste-ai/contracts";
import { api, DEMO_API_KEY } from "@/lib/api";
import { formatPercent, formatScore } from "@/lib/utils";
import { StudioHeader, StatCard } from "@/components/studio/studio-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/misc";

export default function StudioHome() {
  const [dash, setDash] = React.useState<CompanyDashboard | null>(null);
  const [metrics, setMetrics] = React.useState<Metrics | null>(null);
  const [health, setHealth] = React.useState<HealthResponse | null>(null);
  const [error, setError] = React.useState(false);

  React.useEffect(() => {
    Promise.all([api.companyDashboard(DEMO_API_KEY), api.metrics(), api.health()])
      .then(([d, m, h]) => {
        setDash(d);
        setMetrics(m);
        setHealth(h);
      })
      .catch(() => setError(true));
  }, []);

  return (
    <>
      <StudioHeader
        eyebrow="VESTE.AI Studio"
        title="Visão geral"
        description="Cadastre produtos e SKUs, teste o motor via API, visualize o widget incorporado e acompanhe indicadores — tudo sobre o mesmo motor da aplicação."
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/empresa/produtos/novo">Cadastrar produto</Link>
            </Button>
            <Button asChild>
              <Link href="/empresa/api">
                Testar API <ArrowRight />
              </Link>
            </Button>
          </>
        }
      />

      {error ? (
        <div className="rounded-2xl border border-dashed border-border bg-paper p-8 text-center text-sm text-stone">
          API indisponível. Inicie o backend para carregar o Studio.
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {dash ? (
          <>
            <StatCard label="Produtos" value={dash.products_count} hint={`${dash.skus_count} SKUs com medidas`} />
            <StatCard label="Análises" value={dash.analyses_count} hint="Todos os canais" />
            <StatCard label="Chamadas via API" value={dash.api_calls_count} hint="Header X-API-Key" />
            <StatCard label="Chamadas via widget" value={dash.widget_calls_count} hint="Loja parceira" />
          </>
        ) : (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)
        )}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-3xl border border-border bg-paper p-6 shadow-soft">
          <div className="flex items-center justify-between">
            <div>
              <p className="eyebrow">Motor</p>
              <h2 className="mt-1 text-xl font-medium">Resumo de recomendações</h2>
            </div>
            {metrics ? <Badge variant="amber">{metrics.disclaimer}</Badge> : null}
          </div>
          {metrics ? (
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <Mini label="Score médio" value={formatScore(metrics.average_score)} />
              <Mini label="Taxa de recomendação" value={formatPercent(metrics.recommendation_rate)} hint="Análises com score ≥ 7,0" />
              <Mini label="Tamanho mais recomendado" value={metrics.most_recommended_size ?? "—"} />
            </div>
          ) : (
            <Skeleton className="mt-6 h-24" />
          )}
          <Button asChild variant="ghost" size="sm" className="mt-5">
            <Link href="/empresa/metricas">
              Ver métricas completas <ArrowRight />
            </Link>
          </Button>
        </section>

        <section className="rounded-3xl border border-border bg-paper p-6 shadow-soft">
          <p className="eyebrow">Ambiente</p>
          <h2 className="mt-1 text-xl font-medium">Status da plataforma</h2>
          {health ? (
            <ul className="mt-5 space-y-3 text-sm">
              <Row label="API" value={<Badge variant="sage">online</Badge>} />
              <Row label="Banco" value={<span className="font-mono text-xs">{health.database}</span>} />
              <Row label="Visão computacional" value={<span className="font-mono text-xs">{health.vision.mode}</span>} />
              <Row label="Produtos no banco" value={health.products} />
              <Row label="Análises no banco" value={health.analyses} />
            </ul>
          ) : (
            <Skeleton className="mt-5 h-40" />
          )}
        </section>
      </div>

      <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { href: "/empresa/produtos", icon: Boxes, title: "Produtos & SKUs", text: "Ficha técnica por tamanho, tecido e modelagem." },
          { href: "/empresa/api", icon: Code2, title: "Testar API", text: "Request e response reais do POST /recommendations." },
          { href: "/empresa/widget", icon: Puzzle, title: "Widget", text: "<VesteFit /> incorporável em qualquer loja." },
          { href: "/empresa/integracoes", icon: ServerCog, title: "Integrações", text: "Chaves de API e guia de integração." },
        ].map((card) => (
          <Link key={card.href} href={card.href} className="group rounded-3xl border border-border bg-paper p-5 transition hover:-translate-y-0.5 hover:shadow-lift">
            <span className="flex size-10 items-center justify-center rounded-xl bg-ivory">
              <card.icon className="size-4" />
            </span>
            <p className="mt-4 font-medium">{card.title}</p>
            <p className="mt-1 text-sm text-stone">{card.text}</p>
            <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-ink group-hover:text-terracotta">
              Abrir <ArrowRight className="size-3" />
            </span>
          </Link>
        ))}
      </section>
      <p className="mt-6 flex items-center gap-2 text-xs text-stone">
        <BarChart3 className="size-3.5" /> Indicadores calculados com Pandas sobre análises geradas pelo próprio motor em perfis sintéticos.
      </p>
    </>
  );
}

function Mini({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-2xl bg-ivory p-4">
      <p className="text-[11px] uppercase tracking-[0.14em] text-stone">{label}</p>
      <p className="mt-1 font-display text-3xl">{value}</p>
      {hint ? <p className="mt-1 text-xs text-stone">{hint}</p> : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <li className="flex items-center justify-between border-b border-border/60 pb-2 last:border-0">
      <span className="text-stone">{label}</span>
      <span className="font-medium">{value}</span>
    </li>
  );
}
