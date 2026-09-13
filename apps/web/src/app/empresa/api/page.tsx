"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { Play, RotateCcw, Terminal } from "lucide-react";
import type { RecommendationRequest, RecommendationResponse } from "@veste-ai/contracts";
import { api, ApiError, apiBaseUrl, DEMO_API_KEY } from "@/lib/api";
import { StudioHeader } from "@/components/studio/studio-shell";
import { JsonViewer } from "@/components/fit/json-viewer";
import { ScoreRing } from "@/components/fit/score-ring";
import { RegionGrid } from "@/components/fit/region-grid";
import { SizeComparisonBars } from "@/components/fit/size-comparison";
import { ConfidenceBadge } from "@/components/fit/confidence-badge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const DEFAULT_REQUEST: RecommendationRequest = {
  sku: "CAMISETA-001-M",
  customer: { height: 180, chest: 102, waist: 88, hip: 100, shoulder: 45 },
  fit_preference: "regular",
};

export default function ApiTesterPage() {
  return (
    <React.Suspense fallback={null}>
      <ApiTester />
    </React.Suspense>
  );
}

function ApiTester() {
  const params = useSearchParams();
  const initialSku = params.get("sku");
  const [text, setText] = React.useState(() =>
    JSON.stringify(initialSku ? { ...DEFAULT_REQUEST, sku: initialSku } : DEFAULT_REQUEST, null, 2),
  );
  const [response, setResponse] = React.useState<RecommendationResponse | null>(null);
  const [status, setStatus] = React.useState<{ code: number; ms: number } | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  async function run() {
    setBusy(true);
    setError(null);
    const started = performance.now();
    try {
      const payload = JSON.parse(text) as RecommendationRequest;
      const result = await api.recommend({ ...payload, channel: "api" }, DEMO_API_KEY);
      setResponse(result);
      setStatus({ code: 200, ms: Math.round(performance.now() - started) });
    } catch (err) {
      setResponse(null);
      if (err instanceof ApiError) {
        setStatus({ code: err.status, ms: Math.round(performance.now() - started) });
        setError(err.message);
      } else {
        setStatus(null);
        setError(err instanceof SyntaxError ? "JSON inválido." : "Falha de conexão com a API.");
      }
    } finally {
      setBusy(false);
    }
  }

  const curl = `curl -X POST ${apiBaseUrl()}/api/v1/recommendations \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: ${DEMO_API_KEY}" \\
  -d '${text.replace(/\n\s*/g, " ")}'`;

  return (
    <>
      <StudioHeader
        eyebrow="Integração"
        title="Testar recomendação via API"
        description="Envie um request real para o motor VESTE.AI e veja a resposta em JSON e em formato visual. É o mesmo endpoint usado pela aplicação e pelo widget."
        actions={
          <>
            <Button variant="outline" onClick={() => setText(JSON.stringify(DEFAULT_REQUEST, null, 2))}>
              <RotateCcw /> Restaurar exemplo
            </Button>
            <Button onClick={run} disabled={busy}>
              <Play /> {busy ? "Enviando…" : "Enviar request"}
            </Button>
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-2">
        {/* REQUEST */}
        <section className="space-y-4">
          <div className="rounded-3xl border border-border bg-paper p-5 shadow-soft">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge>POST</Badge>
              <code className="font-mono text-xs text-ink-2">{apiBaseUrl()}/api/v1/recommendations</code>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-stone">
              <span className="rounded-md bg-ivory px-2 py-1 font-mono">Content-Type: application/json</span>
              <span className="rounded-md bg-ivory px-2 py-1 font-mono">X-API-Key: {DEMO_API_KEY}</span>
            </div>
            <p className="eyebrow mt-5 mb-2">Request body</p>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              spellCheck={false}
              className="h-72 w-full rounded-2xl border border-border bg-ink p-4 font-mono text-[12.5px] leading-relaxed text-ivory focus:outline-none focus:ring-4 focus:ring-ink/10"
            />
            <p className="mt-2 text-xs text-stone">
              Campos aceitos: <code className="font-mono">sku</code> ou <code className="font-mono">product_id</code> (+ <code className="font-mono">size</code>),{" "}
              <code className="font-mono">customer</code> ou <code className="font-mono">user_id</code>, <code className="font-mono">fit_preference</code>,{" "}
              <code className="font-mono">photo_analysis_id</code>.
            </p>
          </div>
          <div className="rounded-3xl border border-border bg-paper p-5 shadow-soft">
            <p className="eyebrow mb-2 flex items-center gap-2">
              <Terminal className="size-3.5" /> cURL equivalente
            </p>
            <pre className="overflow-x-auto rounded-2xl bg-ivory p-4 font-mono text-[11.5px] leading-relaxed text-ink-2">{curl}</pre>
          </div>
        </section>

        {/* RESPONSE */}
        <section className="rounded-3xl border border-border bg-paper p-5 shadow-soft">
          <div className="flex items-center justify-between">
            <p className="eyebrow">Response</p>
            {status ? (
              <div className="flex items-center gap-2 text-xs">
                <Badge variant={status.code === 200 ? "sage" : "clay"}>HTTP {status.code}</Badge>
                <span className="text-stone">{status.ms} ms</span>
              </div>
            ) : null}
          </div>

          {error ? <p className="mt-4 rounded-xl bg-clay/10 px-4 py-3 text-sm text-clay">{error}</p> : null}

          {!response && !error ? (
            <div className="mt-4 flex h-[420px] flex-col items-center justify-center rounded-2xl border border-dashed border-border text-center">
              <Play className="size-6 text-stone" />
              <p className="mt-3 text-sm text-stone">Envie o request para ver o JSON real retornado pelo backend.</p>
            </div>
          ) : null}

          {response ? (
            <Tabs defaultValue="visual" className="mt-4">
              <TabsList>
                <TabsTrigger value="visual">Visual</TabsTrigger>
                <TabsTrigger value="json">JSON</TabsTrigger>
              </TabsList>
              <TabsContent value="visual" className="space-y-6">
                <div className="flex flex-wrap items-center gap-6 rounded-2xl bg-ivory p-5">
                  <div className="flex size-24 items-center justify-center rounded-3xl bg-ink text-ivory">
                    <span className="font-display text-5xl">{response.recommended_size}</span>
                  </div>
                  <ScoreRing score={response.fit_score} size={104} stroke={8} />
                  <div className="min-w-[180px] flex-1">
                    <p className="font-medium">{response.product_name}</p>
                    <p className="text-sm text-stone">{response.scale_label}</p>
                    <ConfidenceBadge confidence={response.confidence} className="mt-2" />
                  </div>
                </div>
                <div>
                  <p className="eyebrow mb-2">Regiões · tamanho {response.evaluated_size}</p>
                  <RegionGrid regions={response.regions} compact />
                </div>
                <div>
                  <p className="eyebrow mb-2">Comparação</p>
                  <SizeComparisonBars comparison={response.comparison} selectedSize={response.evaluated_size} />
                </div>
                <div className="rounded-2xl bg-ivory p-4 text-sm leading-relaxed text-ink-2">
                  <p>{response.explanation}</p>
                  <p className="mt-2 text-stone">{response.recommendation}</p>
                </div>
              </TabsContent>
              <TabsContent value="json">
                <JsonViewer data={response} maxHeight={640} />
              </TabsContent>
            </Tabs>
          ) : null}
        </section>
      </div>
    </>
  );
}
