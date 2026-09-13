"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, CheckCircle2, ImagePlus, Info, ScanLine, Sun, UserRound, X } from "lucide-react";
import type { PhotoAnalysis } from "@veste-ai/contracts";
import { api, ApiError } from "@/lib/api";
import { useProfile } from "@/lib/profile";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const INSTRUCTIONS = [
  { icon: UserRound, text: "Foto frontal, de corpo inteiro, em pé." },
  { icon: Sun, text: "Fundo neutro e boa iluminação." },
  { icon: ScanLine, text: "Roupas próximas ao corpo ajudam a estimativa." },
];

export function PhotoUpload() {
  const router = useRouter();
  const { user, refresh } = useProfile();
  const [file, setFile] = React.useState<File | null>(null);
  const [preview, setPreview] = React.useState<string | null>(null);
  const [dragging, setDragging] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<PhotoAnalysis | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function pick(next: File | null) {
    setResult(null);
    setError(null);
    if (next && !next.type.startsWith("image/")) {
      setError("Selecione um arquivo de imagem (JPG, PNG ou WebP).");
      return;
    }
    setFile(next);
  }

  async function analyze() {
    if (!user || !file) return;
    setBusy(true);
    setError(null);
    try {
      const analysis = await api.uploadPhoto(user.id, file, true);
      setResult(analysis);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível analisar a foto.");
    } finally {
      setBusy(false);
    }
  }

  if (!user) {
    return (
      <div className="rounded-3xl border border-border bg-paper p-8 text-center">
        <p className="font-medium">Crie seu perfil antes de enviar uma foto.</p>
        <Button asChild className="mt-4">
          <Link href="/consumidor/perfil">Ir para o perfil</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
      <div className="space-y-5">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            pick(e.dataTransfer.files?.[0] ?? null);
          }}
          onClick={() => !preview && inputRef.current?.click()}
          className={cn(
            "relative flex min-h-[420px] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-3xl border-2 border-dashed bg-paper p-8 text-center transition-all",
            dragging ? "border-terracotta bg-terracotta/5" : "border-border hover:border-ink/40",
            preview && "cursor-default border-solid",
          )}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => pick(e.target.files?.[0] ?? null)}
          />
          <AnimatePresence mode="wait">
            {preview ? (
              <motion.div key="preview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="relative w-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={preview} alt="Pré-visualização da foto enviada" className="mx-auto max-h-[440px] rounded-2xl object-contain" />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    pick(null);
                  }}
                  className="absolute right-3 top-3 rounded-full bg-ink/80 p-2 text-ivory backdrop-blur"
                  aria-label="Remover foto"
                >
                  <X className="size-4" />
                </button>
                {busy ? (
                  <motion.div
                    className="pointer-events-none absolute inset-x-8 h-0.5 bg-terracotta shadow-[0_0_24px_4px_rgba(196,98,58,0.5)]"
                    initial={{ top: "5%" }}
                    animate={{ top: ["5%", "95%", "5%"] }}
                    transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                  />
                ) : null}
              </motion.div>
            ) : (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-ivory">
                  <ImagePlus className="size-6 text-stone" />
                </span>
                <div>
                  <p className="font-medium">Arraste sua foto aqui ou clique para selecionar</p>
                  <p className="mt-1 text-sm text-stone">JPG, PNG ou WebP até 8 MB · Opcional</p>
                </div>
                <Badge variant="outline">Imagem utilizada apenas como enriquecimento da estimativa.</Badge>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {error ? <p className="rounded-xl bg-clay/10 px-4 py-3 text-sm text-clay">{error}</p> : null}

        <AnimatePresence>
          {result ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-3xl border border-border bg-paper p-6 shadow-soft"
            >
              <div className="flex items-start gap-3">
                <CheckCircle2 className={cn("mt-0.5 size-5", result.status === "completed" ? "text-sage" : "text-amber")} />
                <div className="flex-1">
                  <p className="font-medium">
                    {result.status === "completed" ? "Proporções estimadas com sucesso" : "Análise visual indisponível para esta imagem"}
                  </p>
                  <p className="mt-1 text-sm text-stone">{result.message}</p>
                  {result.status === "completed" ? (
                    <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                      <Stat label="Ombro / quadril" value={result.shoulder_hip_ratio} />
                      <Stat label="Cintura / quadril" value={result.waist_hip_ratio} />
                      <Stat label="Tronco / pernas" value={result.torso_leg_ratio} />
                    </div>
                  ) : null}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Badge variant="slate">Análise visual experimental</Badge>
                    <Badge variant="outline">Fonte: {result.source}</Badge>
                    <Badge variant="outline">Qualidade: {Math.round(result.quality * 100)}%</Badge>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          <Button asChild variant="outline">
            <Link href="/catalogo">Continuar sem foto</Link>
          </Button>
          {result ? (
            <Button onClick={() => router.push("/catalogo")}>
              Ir para o catálogo <ArrowRight />
            </Button>
          ) : (
            <Button disabled={!file || busy} onClick={analyze}>
              {busy ? "Analisando…" : "Analisar proporções"} <ScanLine />
            </Button>
          )}
        </div>
      </div>

      <aside className="space-y-5">
        <div className="rounded-3xl border border-border bg-paper p-6 shadow-soft">
          <p className="eyebrow">Enquadramento</p>
          <ul className="mt-4 space-y-3">
            {INSTRUCTIONS.map((item) => (
              <li key={item.text} className="flex items-start gap-3 text-sm text-ink-2">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-ivory">
                  <item.icon className="size-4 text-stone" />
                </span>
                <span className="pt-1.5">{item.text}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex gap-3 rounded-3xl border border-border bg-ivory p-5 text-[13px] leading-relaxed text-stone">
          <Info className="mt-0.5 size-4 shrink-0" />
          <p>
            A aplicação nunca usa a imagem para classificar a aparência. Sem foto, a estimativa continua funcionando com as
            medidas informadas e o nível de confiança é ajustado.
          </p>
        </div>
      </aside>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="rounded-xl bg-ivory p-3">
      <p className="text-[10.5px] uppercase tracking-wider text-stone">{label}</p>
      <p className="mt-1 font-display text-xl">{value == null ? "—" : value.toFixed(2).replace(".", ",")}</p>
    </div>
  );
}
