import Link from "next/link";
import {
  ArrowRight,
  Building2,
  Code2,
  Database,
  Gauge,
  LockKeyhole,
  PackageCheck,
  Puzzle,
  ScanLine,
  ShoppingBag,
  Sparkles,
  UserRound,
} from "lucide-react";
import { SiteShell } from "@/components/site/shell";
import { HeroPreview } from "@/components/site/hero-preview";
import { Reveal, Stagger, StaggerItem } from "@/components/site/reveal";
import { WeightsBar } from "@/components/fit/how-we-calculate";
import { Button } from "@/components/ui/button";

const FLOW = [
  { icon: ShoppingBag, label: "Problema", text: "Foto bonita da roupa não garante o tamanho certo." },
  { icon: Database, label: "Dados", text: "Medidas do corpo + ficha técnica da peça + tecido." },
  { icon: Gauge, label: "Motor", text: "Cálculo determinístico e explicável por região." },
  { icon: Sparkles, label: "Score", text: "0 a 10 com nível de confiança." },
  { icon: PackageCheck, label: "Tamanho", text: "Recomendação e comparação entre tamanhos." },
  { icon: Code2, label: "API", text: "O mesmo motor exposto para e-commerces." },
  { icon: Puzzle, label: "Widget", text: "Componente incorporável na página do produto." },
];

export default function HomePage() {
  return (
    <SiteShell>
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="bg-editorial absolute inset-0 -z-10" />
        <div className="container-veste grid items-center gap-14 pb-20 pt-16 lg:grid-cols-[1.05fr_0.95fr] lg:pb-28 lg:pt-24">
          <div className="space-y-8">
            <Reveal>
              <span className="inline-flex items-center gap-2 rounded-full border border-border bg-paper px-3 py-1.5 text-xs font-medium text-stone">
                <span className="size-1.5 rounded-full bg-terracotta" />
                Plataforma de recomendação de tamanho e caimento
              </span>
            </Reveal>
            <Reveal delay={0.05}>
              <h1 className="text-balance text-5xl font-medium leading-[1.02] md:text-6xl lg:text-[68px]">
                Escolha o tamanho certo <em className="font-light italic text-terracotta">antes</em> de comprar.
              </h1>
            </Reveal>
            <Reveal delay={0.1}>
              <p className="max-w-xl text-lg leading-relaxed text-stone">
                A VESTE.AI usa dados para estimar como uma peça tende a vestir e ajudar você a escolher um tamanho com
                mais segurança.
              </p>
            </Reveal>
            <Reveal delay={0.15} className="flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href="/consumidor/perfil">
                  <UserRound /> Sou consumidor
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/empresa">
                  <Building2 /> Sou empresa
                </Link>
              </Button>
            </Reveal>
            <Reveal delay={0.2}>
              <p className="text-sm text-stone">
                Sem julgamento corporal. Sem reconhecimento facial. Foto sempre opcional.
              </p>
            </Reveal>
          </div>
          <HeroPreview />
        </div>
      </section>

      {/* MENSAGEM CENTRAL */}
      <section className="border-y border-border/70 bg-ink text-ivory">
        <div className="container-veste py-16 md:py-20">
          <Reveal>
            <p className="eyebrow text-ivory/60">Princípio</p>
            <blockquote className="mt-4 max-w-4xl text-balance font-display text-2xl font-light leading-snug md:text-4xl">
              “A VESTE.AI não diz se uma roupa fica bonita ou feia em uma pessoa. Ela usa dados para estimar como aquela
              peça tende a vestir e ajudar o consumidor a tomar uma decisão de compra mais informada.”
            </blockquote>
          </Reveal>
        </div>
      </section>

      {/* FLUXO */}
      <section className="container-veste py-20">
        <Reveal className="max-w-2xl">
          <p className="eyebrow">Do problema à integração</p>
          <h2 className="mt-3 text-3xl font-medium md:text-4xl">Um único motor servindo diferentes canais.</h2>
          <p className="mt-3 text-stone">
            Aplicação própria, API B2B e widget incorporável consultam exatamente a mesma lógica de recomendação.
          </p>
        </Reveal>
        <Stagger className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-7">
          {FLOW.map((step, i) => (
            <StaggerItem key={step.label} className="relative">
              <div className="h-full rounded-2xl border border-border bg-paper p-4 transition hover:shadow-soft">
                <div className="flex items-center justify-between">
                  <span className="flex size-9 items-center justify-center rounded-xl bg-ivory text-ink">
                    <step.icon className="size-4" />
                  </span>
                  <span className="font-mono text-[11px] text-stone">0{i + 1}</span>
                </div>
                <p className="mt-4 font-medium">{step.label}</p>
                <p className="mt-1 text-[12.5px] leading-snug text-stone">{step.text}</p>
              </div>
              {i < FLOW.length - 1 ? (
                <ArrowRight className="absolute -right-4 top-1/2 hidden size-4 -translate-y-1/2 text-mist lg:block" />
              ) : null}
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      {/* TRES CAMADAS */}
      <section className="bg-paper">
        <div className="container-veste py-20">
          <Reveal className="max-w-2xl">
            <p className="eyebrow">Plataforma</p>
            <h2 className="mt-3 text-3xl font-medium md:text-4xl">Três camadas, uma inteligência.</h2>
          </Reveal>
          <Stagger className="mt-12 grid gap-5 lg:grid-cols-3">
            {[
              {
                title: "Consumer Experience",
                text: "Perfil, medidas, preferência de caimento, foto opcional, catálogo e a tela de resultado com comparação entre tamanhos.",
                href: "/consumidor/perfil",
                cta: "Começar como consumidor",
                icon: UserRound,
              },
              {
                title: "VESTE.AI Studio",
                text: "Área B2B para cadastrar produtos, SKUs e medidas, testar a API, visualizar o widget e acompanhar métricas.",
                href: "/empresa",
                cta: "Abrir o Studio",
                icon: Building2,
              },
              {
                title: "VESTE.AI Widget",
                text: "Componente <VesteFit /> incorporável na página de produto de qualquer loja: “Descubra seu tamanho ideal”.",
                href: "/loja-parceira",
                cta: "Ver loja parceira",
                icon: Puzzle,
              },
            ].map((layer) => (
              <StaggerItem key={layer.title}>
                <div className="group flex h-full flex-col rounded-3xl border border-border bg-ivory p-7 transition hover:-translate-y-0.5 hover:shadow-lift">
                  <span className="flex size-11 items-center justify-center rounded-2xl bg-ink text-ivory">
                    <layer.icon className="size-5" />
                  </span>
                  <h3 className="mt-6 text-2xl font-medium">{layer.title}</h3>
                  <p className="mt-3 flex-1 text-[15px] leading-relaxed text-stone">{layer.text}</p>
                  <Link href={layer.href} className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-ink group-hover:text-terracotta">
                    {layer.cta} <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
                  </Link>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* COMO CALCULAMOS */}
      <section className="container-veste grid gap-12 py-20 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <Reveal>
          <p className="eyebrow">Explicabilidade</p>
          <h2 className="mt-3 text-3xl font-medium md:text-4xl">Como calculamos?</h2>
          <p className="mt-4 text-stone">
            Score determinístico de 0 a 10 que combina cinco componentes normalizados. Cada resultado mostra por que um
            tamanho foi sugerido — região por região.
          </p>
          <Button asChild variant="outline" className="mt-6">
            <Link href="/como-calculamos">
              Ver o algoritmo <ArrowRight />
            </Link>
          </Button>
        </Reveal>
        <Reveal delay={0.1} className="rounded-3xl border border-border bg-paper p-7 shadow-soft">
          <p className="font-mono text-xs text-stone">score =</p>
          <pre className="mt-2 overflow-x-auto font-mono text-[13px] leading-relaxed text-ink-2">
{`0.40 × medidas
+ 0.20 × modelagem
+ 0.15 × elasticidade do tecido
+ 0.15 × proporções (foto, opcional)
+ 0.10 × preferência declarada`}
          </pre>
          <WeightsBar className="mt-6" />
          <p className="mt-5 text-xs text-stone">Parâmetros heurísticos do MVP — não apresentados como cientificamente validados.</p>
        </Reveal>
      </section>

      {/* PRIVACIDADE */}
      <section className="border-t border-border/70 bg-paper">
        <div className="container-veste grid gap-8 py-16 md:grid-cols-3">
          {[
            { icon: LockKeyhole, title: "Foto opcional e com consentimento", text: "A imagem é processada em memória e descartada. Só proporções aproximadas são guardadas." },
            { icon: ScanLine, title: "Sem reconhecimento facial", text: "Nenhuma classificação estética. A análise visual é experimental e apenas enriquece a estimativa." },
            { icon: Sparkles, title: "Linguagem neutra", text: "O score avalia a compatibilidade entre pessoa e peça — nunca é uma nota para o corpo." },
          ].map((item) => (
            <Reveal key={item.title} className="flex gap-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-ivory">
                <item.icon className="size-4" />
              </span>
              <div>
                <p className="font-medium">{item.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-stone">{item.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="container-veste py-20">
        <Reveal className="grain relative overflow-hidden rounded-[32px] border border-border bg-ivory px-8 py-14 text-center md:px-16">
          <h2 className="text-balance text-3xl font-medium md:text-5xl">Pronto para ver o motor em ação?</h2>
          <p className="mx-auto mt-4 max-w-xl text-stone">
            Informe suas medidas, escolha uma peça do catálogo e receba a recomendação com explicação completa em segundos.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/consumidor/perfil">Criar meu perfil</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/catalogo">Explorar catálogo</Link>
            </Button>
          </div>
        </Reveal>
      </section>
    </SiteShell>
  );
}
