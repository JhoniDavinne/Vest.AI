import type { Metadata } from "next";
import type { EngineConfigResponse } from "@veste-ai/contracts";
import { api } from "@/lib/api";
import { SiteShell, PageIntro } from "@/components/site/shell";
import { Reveal } from "@/components/site/reveal";
import { WeightsBar } from "@/components/fit/how-we-calculate";
import { ENGINE_COMPONENTS } from "@/lib/engine-components";
import { JsonViewer } from "@/components/fit/json-viewer";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Como calculamos" };
export const dynamic = "force-dynamic";

const SCALE = [
  { range: "8,5 – 10", label: "Alta compatibilidade", color: "var(--sage)", text: "A peça tende a apresentar bom ajuste nas medidas informadas." },
  { range: "7,0 – 8,4", label: "Boa compatibilidade", color: "#7C9A6A", text: "Boa opção; pode haver pequena diferença em uma região específica." },
  { range: "5,0 – 6,9", label: "Compatibilidade moderada", color: "var(--amber)", text: "O tamanho pode servir, mas recomendamos observar algumas regiões." },
  { range: "0 – 4,9", label: "Baixa compatibilidade", color: "var(--clay)", text: "Outro tamanho ou modelagem tende a oferecer ajuste mais próximo da preferência informada." },
];

const CONFIDENCE = [
  { level: "Alta", text: "Medidas completas e análise visual disponível.", color: "var(--sage)" },
  { level: "Média", text: "Baseada nas medidas informadas (sem foto).", color: "var(--amber)" },
  { level: "Baixa", text: "Faltam informações para uma estimativa mais precisa.", color: "var(--clay)" },
];

export default async function HowPage() {
  let config: EngineConfigResponse | null = null;
  try {
    config = await api.engineConfig();
  } catch {
    config = null;
  }

  return (
    <SiteShell>
      <PageIntro
        eyebrow="Explicabilidade"
        title="Como calculamos?"
        description="Um motor determinístico e explicável. Mesmas entradas, mesma saída — e cada resultado mostra a contribuição de cada componente."
      />

      <div className="container-veste space-y-16 pb-24">
        {/* FORMULA */}
        <Reveal className="grid gap-8 rounded-[32px] border border-border bg-paper p-8 shadow-soft lg:grid-cols-[1fr_1fr]">
          <div>
            <p className="eyebrow">Fórmula do MVP</p>
            <pre className="mt-4 overflow-x-auto rounded-2xl bg-ink p-5 font-mono text-[13px] leading-relaxed text-ivory">
{`score = 10 × (
    0.40 × medidas
  + 0.20 × modelagem
  + 0.15 × elasticidade
  + 0.15 × proporções (foto)
  + 0.10 × preferência
)`}
            </pre>
            <p className="mt-4 text-sm text-stone">
              Todos os componentes produzem valores normalizados entre 0 e 1. Sem foto autorizada, o peso das proporções é
              redistribuído proporcionalmente entre os demais componentes e a confiança é reduzida.
            </p>
          </div>
          <div className="flex flex-col justify-center">
            <WeightsBar />
            <div className="mt-6 flex flex-wrap gap-2">
              <Badge variant="amber">Parâmetros heurísticos do MVP</Badge>
              <Badge variant="outline">Não validados cientificamente</Badge>
              <Badge variant="outline">Configuráveis via JSON</Badge>
            </div>
          </div>
        </Reveal>

        {/* COMPONENTES */}
        <section className="space-y-6">
          <Reveal>
            <p className="eyebrow">Os cinco componentes</p>
            <h2 className="mt-1 text-3xl font-medium">O que entra no cálculo</h2>
          </Reveal>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            {ENGINE_COMPONENTS.map((c, i) => (
              <Reveal key={c.key} delay={0.05 * i} className="rounded-3xl border border-border bg-paper p-5">
                <div className="flex items-center justify-between">
                  <span className="flex size-10 items-center justify-center rounded-xl" style={{ background: `${c.color}1A`, color: c.color }}>
                    <c.icon className="size-4" />
                  </span>
                  <span className="font-display text-2xl">{Math.round(c.weight * 100)}%</span>
                </div>
                <p className="mt-4 font-medium">{c.label}</p>
                <p className="mt-2 text-[13px] leading-relaxed text-stone">
                  {config?.components.find((x) => x.key === c.key)?.description ?? c.description}
                </p>
              </Reveal>
            ))}
          </div>
        </section>

        {/* PASSO A PASSO */}
        <section className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
          <Reveal>
            <p className="eyebrow">Passo a passo</p>
            <h2 className="mt-1 text-3xl font-medium">Da medida ao score</h2>
            <p className="mt-3 text-sm text-stone">
              Para cada tamanho da peça o motor executa os passos ao lado. O tamanho com maior score é o recomendado; os
              demais aparecem na comparação.
            </p>
          </Reveal>
          <Reveal delay={0.1} className="space-y-3">
            {[
              ["Folga real", "Para cada região (peito, cintura, quadril, ombros, comprimento): folga = medida da peça − medida do corpo."],
              ["Folga prevista", "A modelagem define quanta folga a peça foi desenhada para ter (ex.: camiseta regular: +10 cm no peito)."],
              ["Desvio", "desvio = folga real − folga prevista. Perto de zero → Compatível; muito negativo → Folga recomendada; fora da faixa → Atenção."],
              ["Componentes", "Medidas: curva suave sobre o desvio. Modelagem: quanto do desvio a faixa da modelagem absorve. Tecido: quanto da tensão a elasticidade compensa. Preferência: desloca a folga ideal (justo −3 cm, solto +4 cm). Proporções: reponderam as regiões pela silhueta estimada."],
              ["Score e confiança", "Soma ponderada × 10, arredondada para 1 casa. A confiança reflete completude dos dados, foto utilizável, cobertura da ficha técnica e margem entre os tamanhos."],
            ].map(([title, text], i) => (
              <div key={title} className="flex gap-4 rounded-2xl border border-border bg-paper p-5">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-ink font-mono text-xs text-ivory">{i + 1}</span>
                <div>
                  <p className="font-medium">{title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-stone">{text}</p>
                </div>
              </div>
            ))}
          </Reveal>
        </section>

        {/* ESCALA E CONFIANCA */}
        <section className="grid gap-8 lg:grid-cols-2">
          <Reveal className="rounded-[32px] border border-border bg-paper p-8">
            <p className="eyebrow">Escala de caimento</p>
            <div className="mt-5 space-y-3">
              {SCALE.map((s) => (
                <div key={s.range} className="flex gap-4 rounded-2xl bg-ivory p-4">
                  <span className="mt-1 size-3 shrink-0 rounded-full" style={{ background: s.color }} />
                  <div>
                    <p className="font-medium">
                      <span className="font-display">{s.range}</span> · {s.label}
                    </p>
                    <p className="mt-1 text-sm text-stone">“{s.text}”</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs text-stone">O score nunca é uma nota para o corpo da pessoa — é uma estimativa de compatibilidade entre pessoa e peça.</p>
          </Reveal>
          <Reveal delay={0.1} className="rounded-[32px] border border-border bg-paper p-8">
            <p className="eyebrow">Nível de confiança</p>
            <div className="mt-5 space-y-3">
              {CONFIDENCE.map((c) => (
                <div key={c.level} className="flex gap-4 rounded-2xl bg-ivory p-4">
                  <span className="mt-1 size-3 shrink-0 rounded-full" style={{ background: c.color }} />
                  <div>
                    <p className="font-medium">Confiança {c.level.toLowerCase()}</p>
                    <p className="mt-1 text-sm text-stone">{c.text}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs text-stone">Se faltarem medidas ou a foto não tiver qualidade suficiente, a aplicação reduz a confiança em vez de inventar precisão.</p>
          </Reveal>
        </section>

        {/* PARAMETROS */}
        <section className="space-y-4">
          <Reveal>
            <p className="eyebrow">Parâmetros vigentes</p>
            <h2 className="mt-1 text-3xl font-medium">Transparência total</h2>
            <p className="mt-2 max-w-2xl text-sm text-stone">
              Configuração retornada em tempo real por <code className="font-mono text-xs">GET /api/v1/engine/config</code>. Todos os valores
              são heurísticos e ajustáveis; a evolução prevista é calibrá-los com histórico real de compras, trocas e devoluções.
            </p>
          </Reveal>
          <Reveal delay={0.05}>
            {config ? <JsonViewer data={config.parameters} maxHeight={520} /> : <p className="text-sm text-stone">API indisponível no momento.</p>}
          </Reveal>
        </section>
      </div>
    </SiteShell>
  );
}
