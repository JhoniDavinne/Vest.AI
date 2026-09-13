"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Camera, Ruler, Scissors, Sparkles, UserRound, Wand2 } from "lucide-react";
import type { Product } from "@veste-ai/contracts";
import { api, ApiError } from "@/lib/api";
import { useProfile } from "@/lib/profile";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const STAGES = [
  { icon: Ruler, text: "Comparando medidas do corpo com a ficha técnica…" },
  { icon: Scissors, text: "Aplicando tolerância da modelagem e do tecido…" },
  { icon: Camera, text: "Ponderando preferência e proporções…" },
  { icon: Sparkles, text: "Calculando score por tamanho…" },
];

export function AnalyzeCta({ product }: { product: Product }) {
  const router = useRouter();
  const { user, setUser, loading } = useProfile();
  const [selected, setSelected] = React.useState<string>(product.sizes[Math.floor(product.sizes.length / 2)]?.sku);
  const [processing, setProcessing] = React.useState(false);
  const [stage, setStage] = React.useState(0);
  const [needProfile, setNeedProfile] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!processing) return;
    setStage(0);
    const id = setInterval(() => setStage((s) => Math.min(s + 1, STAGES.length - 1)), 420);
    return () => clearInterval(id);
  }, [processing]);

  async function analyze(userId: string) {
    setProcessing(true);
    setError(null);
    const started = Date.now();
    try {
      const result = await api.recommend({ sku: selected, user_id: userId, channel: "web" });
      const elapsed = Date.now() - started;
      // pausa curta para a etapa de "processamento" ser perceptivel na demonstracao
      await new Promise((r) => setTimeout(r, Math.max(0, 1500 - elapsed)));
      router.push(`/analise/${result.analysis_id}`);
    } catch (err) {
      setProcessing(false);
      setError(err instanceof ApiError ? err.message : "Não foi possível calcular a recomendação.");
    }
  }

  async function useDemoProfile() {
    try {
      const created = await api.createUser({
        name: "Perfil Demonstração",
        fit_preference: "regular",
        photo_consent: false,
        measurements: { height: 180, weight: 78, chest: 102, waist: 88, hip: 100, shoulder: 45 },
      });
      setUser(created);
      setNeedProfile(false);
      await analyze(created.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível criar o perfil demo.");
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-medium">Tamanho a avaliar</p>
          <span className="text-xs text-stone">O motor compara todos e indica o recomendado</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {product.sizes.map((s) => (
            <button
              key={s.sku}
              type="button"
              onClick={() => setSelected(s.sku)}
              className={cn(
                "min-w-12 rounded-xl border px-4 py-2.5 font-display text-base transition-all",
                selected === s.sku ? "border-ink bg-ink text-ivory shadow-soft" : "border-border bg-paper hover:border-ink/40",
              )}
              aria-pressed={selected === s.sku}
            >
              {s.size_label}
            </button>
          ))}
        </div>
      </div>

      <Button
        size="lg"
        className="w-full"
        disabled={processing || loading}
        onClick={() => (user ? analyze(user.id) : setNeedProfile(true))}
      >
        <Sparkles /> Analisar caimento
      </Button>
      {user ? (
        <p className="text-center text-xs text-stone">
          Usando o perfil <span className="font-medium text-ink">{user.name}</span> · preferência {user.fit_preference === "tight" ? "justo" : user.fit_preference === "loose" ? "solto" : "regular"}
          {user.photo_analysis?.status === "completed" ? " · com foto" : " · sem foto"} ·{" "}
          <Link href="/consumidor/perfil" className="underline underline-offset-2">
            editar
          </Link>
        </p>
      ) : null}
      {error ? <p className="rounded-xl bg-clay/10 px-4 py-3 text-sm text-clay">{error}</p> : null}

      {/* Processamento */}
      <Dialog open={processing}>
        <DialogContent className="max-w-md [&>button]:hidden" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Analisando caimento</DialogTitle>
            <DialogDescription>O motor VESTE.AI cruza perfil, medidas da peça, tecido e modelagem.</DialogDescription>
          </DialogHeader>
          <div className="mt-2 space-y-3">
            {STAGES.map((s, i) => (
              <div key={s.text} className={cn("flex items-center gap-3 text-sm transition", i > stage && "opacity-30")}>
                <span className={cn("flex size-8 items-center justify-center rounded-lg", i <= stage ? "bg-ink text-ivory" : "bg-ivory text-stone")}>
                  <s.icon className="size-4" />
                </span>
                <span>{s.text}</span>
                <AnimatePresence>
                  {i === stage ? (
                    <motion.span
                      className="ml-auto size-2 rounded-full bg-terracotta"
                      animate={{ scale: [1, 1.5, 1] }}
                      transition={{ repeat: Infinity, duration: 0.9 }}
                    />
                  ) : null}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Sem perfil */}
      <Dialog open={needProfile} onOpenChange={setNeedProfile}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Precisamos das suas medidas</DialogTitle>
            <DialogDescription>
              A recomendação usa medidas persistidas no seu perfil. Crie o seu em um minuto ou use o perfil de demonstração.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-2 grid gap-3">
            <Button asChild>
              <Link href="/consumidor/perfil">
                <UserRound /> Criar meu perfil
              </Link>
            </Button>
            <Button variant="outline" onClick={useDemoProfile}>
              <Wand2 /> Usar perfil demo (180 cm · 102 · 88 · 100 · 45)
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
