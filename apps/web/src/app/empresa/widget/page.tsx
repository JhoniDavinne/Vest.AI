"use client";

import * as React from "react";
import Link from "next/link";
import { Copy, Check, ExternalLink, Puzzle } from "lucide-react";
import { VesteFit } from "@veste-ai/widget";
import { api, apiBaseUrl, DEMO_API_KEY } from "@/lib/api";
import { StudioHeader } from "@/components/studio/studio-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function StudioWidgetPage() {
  const [copied, setCopied] = React.useState(false);
  const [base, setBase] = React.useState("http://localhost:8000");
  const [sku, setSku] = React.useState("CAMISETA-001-M");

  React.useEffect(() => {
    setBase(apiBaseUrl());
    api
      .listProducts()
      .then((products) => {
        const featured = products.find((p) => p.slug === "camiseta-essential-algodao") ?? products[0];
        if (featured?.available_sizes.includes("M")) setSku("CAMISETA-001-M");
      })
      .catch(() => undefined);
  }, []);

  const snippet = `import { VesteFit } from "@veste-ai/widget";

<VesteFit
  productId="camiseta-essential-algodao"
  sku="${sku}"
  apiBaseUrl="${base}"
  apiKey="${DEMO_API_KEY}"
  label="Descubra seu tamanho ideal"
/>`;

  async function copy() {
    await navigator.clipboard.writeText(snippet);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <>
      <StudioHeader
        eyebrow="SaaS incorporável"
        title="Widget VESTE.AI"
        description="O mesmo motor da aplicação própria, empacotado como <VesteFit />. A loja hospedeira só precisa de um productId ou SKU e da chave de integração."
        actions={
          <Button asChild>
            <Link href="/loja-parceira/produto/camiseta-essential-algodao">
              Ver na loja parceira <ExternalLink />
            </Link>
          </Button>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <section className="rounded-3xl border border-border bg-paper p-6 shadow-soft">
          <div className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-xl bg-ivory">
              <Puzzle className="size-4" />
            </span>
            <div>
              <p className="eyebrow">Pré-visualização</p>
              <h2 className="text-lg font-medium">Botão + modal do widget</h2>
            </div>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-stone">
            Clique no botão. O widget abre um modal, coleta medidas e preferência, chama{" "}
            <code className="font-mono text-[12px]">POST /api/v1/recommendations</code> com canal{" "}
            <code className="font-mono text-[12px]">widget</code> e devolve o mesmo JSON da API.
          </p>
          <div className="mt-6 rounded-2xl border border-dashed border-border bg-ivory p-6">
            <p className="mb-4 text-[11px] uppercase tracking-[0.14em] text-stone">Página de produto da loja</p>
            <div className="rounded-2xl bg-paper p-5 shadow-soft">
              <p className="text-xs text-stone">Camiseta Essential · Regular</p>
              <p className="mt-1 font-display text-2xl">Algodão 180 g</p>
              <p className="mt-2 text-sm text-stone">R$ 129,00 · SKU {sku}</p>
              <div className="mt-5">
                <VesteFit
                  productId="camiseta-essential-algodao"
                  sku={sku}
                  apiBaseUrl={base}
                  apiKey={DEMO_API_KEY}
                  initialMeasurements={{ height: 180, chest: 102, waist: 88, hip: 100, shoulder: 45 }}
                />
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="rounded-3xl border border-border bg-paper p-6 shadow-soft">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="eyebrow">Integração</p>
                <h2 className="text-lg font-medium">Snippet React</h2>
              </div>
              <Button variant="outline" size="sm" onClick={copy}>
                {copied ? <Check /> : <Copy />}
                {copied ? "Copiado" : "Copiar"}
              </Button>
            </div>
            <pre className="mt-4 overflow-x-auto rounded-2xl bg-ink p-4 font-mono text-[12px] leading-relaxed text-ivory">
              {snippet}
            </pre>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge variant="outline">productId</Badge>
              <Badge variant="outline">sku</Badge>
              <Badge variant="outline">X-API-Key</Badge>
              <Badge variant="secondary">canal = widget</Badge>
            </div>
          </div>

          <div className="rounded-3xl border border-border bg-paper p-6 shadow-soft">
            <p className="eyebrow">Contrato</p>
            <h2 className="mt-1 text-lg font-medium">O que o widget envia e recebe</h2>
            <ul className="mt-4 space-y-3 text-sm leading-relaxed text-ink-2">
              <li>
                <strong>Entrada:</strong> SKU ou produto, medidas do consumidor, preferência de caimento.
              </li>
              <li>
                <strong>Saída:</strong> tamanho recomendado, score 0–10, confiança, regiões e comparação entre tamanhos.
              </li>
              <li>
                <strong>Motor:</strong> nenhum cálculo no front-end. A chamada vai para o mesmo FastAPI da aplicação
                própria.
              </li>
              <li>
                <strong>Privacidade:</strong> o canal do widget não envia foto. A análise visual fica no fluxo da
                aplicação VESTE.AI, com consentimento explícito.
              </li>
            </ul>
          </div>
        </section>
      </div>
    </>
  );
}
