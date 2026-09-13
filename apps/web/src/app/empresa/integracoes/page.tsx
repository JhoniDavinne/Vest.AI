"use client";

import * as React from "react";
import Link from "next/link";
import { Check, Copy, KeyRound } from "lucide-react";
import type { CompanyDashboard } from "@veste-ai/contracts";
import { api, apiBaseUrl, DEMO_API_KEY } from "@/lib/api";
import { StudioHeader } from "@/components/studio/studio-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/misc";

export default function StudioIntegrationsPage() {
  const [dash, setDash] = React.useState<CompanyDashboard | null>(null);
  const [copied, setCopied] = React.useState<string | null>(null);
  const [base, setBase] = React.useState("http://localhost:8000");

  React.useEffect(() => {
    setBase(apiBaseUrl());
    api.companyDashboard(DEMO_API_KEY).then(setDash).catch(() => setDash(null));
  }, []);

  async function copy(value: string, id: string) {
    await navigator.clipboard.writeText(value);
    setCopied(id);
    window.setTimeout(() => setCopied(null), 1600);
  }

  const curl = `curl -X POST ${base}/api/v1/recommendations \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: ${DEMO_API_KEY}" \\
  -d '{"sku":"CAMISETA-001-M","customer":{"height":180,"chest":102,"waist":88,"hip":100,"shoulder":45},"fit_preference":"regular"}'`;

  return (
    <>
      <StudioHeader
        eyebrow="B2B"
        title="Integrações"
        description="Chaves de API da empresa demo, autenticação por header e o contrato mínimo para um e-commerce consumir o motor VESTE.AI."
        actions={
          <Button asChild variant="outline">
            <Link href="/empresa/api">Abrir tester da API</Link>
          </Button>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-3xl border border-border bg-paper p-6 shadow-soft">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-ivory">
              <KeyRound className="size-4" />
            </span>
            <div>
              <p className="eyebrow">Empresa</p>
              <h2 className="text-xl font-medium">{dash?.company.name ?? "Loja Parceira Demo"}</h2>
            </div>
          </div>
          {dash ? (
            <ul className="mt-5 space-y-2 text-sm">
              <Row label="Slug" value={dash.company.slug} />
              <Row label="Segmento" value={dash.company.segment} />
              <Row label="Plano" value={dash.company.plan} />
              <Row label="Produtos" value={String(dash.products_count)} />
              <Row label="SKUs" value={String(dash.skus_count)} />
            </ul>
          ) : (
            <Skeleton className="mt-5 h-40" />
          )}

          <p className="eyebrow mt-8 mb-3">Chaves de integração</p>
          <div className="space-y-3">
            {dash
              ? dash.integration_keys.map((key) => (
                  <div key={key.id} className="rounded-2xl border border-border bg-ivory p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-medium">{key.label}</p>
                        <p className="mt-0.5 font-mono text-[12px] text-ink-2">{key.key}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={key.active ? "sage" : "slate"}>{key.active ? "ativa" : "inativa"}</Badge>
                        <Badge variant="secondary">{key.usage_count} usos nesta sessão</Badge>
                        <Button variant="outline" size="sm" onClick={() => copy(key.key, key.id)}>
                          {copied === key.id ? <Check /> : <Copy />}
                        </Button>
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-stone">Envie no header X-API-Key em todas as chamadas B2B.</p>
                  </div>
                ))
              : Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
          </div>
        </section>

        <section className="space-y-4">
          <div className="rounded-3xl border border-border bg-paper p-6 shadow-soft">
            <p className="eyebrow">Guia rápido</p>
            <h2 className="mt-1 text-xl font-medium">Como integrar</h2>
            <ol className="mt-5 list-decimal space-y-3 pl-5 text-sm leading-relaxed text-ink-2">
              <li>Cadastre o produto e as medidas por tamanho no Studio ou via POST /api/v1/products.</li>
              <li>Guarde a chave de integração. Ela identifica a empresa e atribui o canal (api ou widget).</li>
              <li>
                No checkout ou na PDP, envie SKU + medidas do consumidor para POST /api/v1/recommendations.
              </li>
              <li>Exiba o tamanho recomendado, o score e a justificativa. Não replique o algoritmo no front-end.</li>
              <li>Opcionalmente, incorpore &lt;VesteFit /&gt; para o consumidor informar as medidas na própria loja.</li>
            </ol>
          </div>
          <div className="rounded-3xl border border-border bg-paper p-6 shadow-soft">
            <div className="flex items-center justify-between">
              <p className="eyebrow">cURL de demonstração</p>
              <Button variant="outline" size="sm" onClick={() => copy(curl, "curl")}>
                {copied === "curl" ? <Check /> : <Copy />}
              </Button>
            </div>
            <pre className="mt-3 overflow-x-auto rounded-2xl bg-ink p-4 font-mono text-[11.5px] leading-relaxed text-ivory">
              {curl}
            </pre>
            <p className="mt-3 text-xs text-stone">
              Documentação interativa:{" "}
              <a className="underline underline-offset-2" href={`${base}/docs`} target="_blank" rel="noreferrer">
                {base}/docs
              </a>
            </p>
          </div>
        </section>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <li className="flex items-center justify-between border-b border-border/60 pb-2 last:border-0">
      <span className="text-stone">{label}</span>
      <span className="font-medium">{value}</span>
    </li>
  );
}
