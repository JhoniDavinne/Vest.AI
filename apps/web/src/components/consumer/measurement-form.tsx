"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight, Camera, Info, Wand2 } from "lucide-react";
import type { FitPreference, Measurements } from "@veste-ai/contracts";
import { FIT_PREFERENCE_LABEL } from "@veste-ai/contracts";
import { api, ApiError } from "@/lib/api";
import { useProfile } from "@/lib/profile";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/misc";

const DEMO: Required<Measurements> = { height: 180, weight: 78, chest: 102, waist: 88, hip: 100, shoulder: 45 };

const FIELDS: { key: keyof Measurements; label: string; hint: string; unit: string }[] = [
  { key: "height", label: "Altura", hint: "Sem sapatos, em pé.", unit: "cm" },
  { key: "weight", label: "Peso", hint: "Aproximado.", unit: "kg" },
  { key: "chest", label: "Peito / tórax", hint: "Circunferência na parte mais larga.", unit: "cm" },
  { key: "waist", label: "Cintura", hint: "Circunferência na altura do umbigo.", unit: "cm" },
  { key: "hip", label: "Quadril", hint: "Circunferência na parte mais larga.", unit: "cm" },
  { key: "shoulder", label: "Ombros", hint: "De uma ponta do ombro à outra, pelas costas.", unit: "cm" },
];

const PREF_DESCRIPTION: Record<FitPreference, string> = {
  tight: "Peça mais próxima do corpo.",
  regular: "Folga prevista pela modelagem.",
  loose: "Mais espaço e movimento.",
};

export function MeasurementForm() {
  const router = useRouter();
  const { user, setUser } = useProfile();
  const [name, setName] = React.useState("");
  const [values, setValues] = React.useState<Record<keyof Measurements, string>>({
    height: "", weight: "", chest: "", waist: "", hip: "", shoulder: "",
  });
  const [preference, setPreference] = React.useState<FitPreference>("regular");
  const [consent, setConsent] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!user) return;
    setName(user.name);
    setPreference(user.fit_preference);
    setConsent(user.photo_consent);
    const m = user.measurements;
    if (m) {
      setValues({
        height: m.height?.toString() ?? "",
        weight: m.weight?.toString() ?? "",
        chest: m.chest?.toString() ?? "",
        waist: m.waist?.toString() ?? "",
        hip: m.hip?.toString() ?? "",
        shoulder: m.shoulder?.toString() ?? "",
      });
    }
  }, [user]);

  const measurements = React.useMemo<Measurements>(() => {
    const out: Measurements = {};
    (Object.keys(values) as (keyof Measurements)[]).forEach((k) => {
      const n = Number(values[k].replace(",", "."));
      out[k] = values[k].trim() === "" || Number.isNaN(n) ? null : n;
    });
    return out;
  }, [values]);

  const completeness = (Object.values(measurements).filter((v) => v != null).length / FIELDS.length) * 100;
  const canSubmit = name.trim().length >= 2 && ["chest", "waist", "hip", "shoulder"].every((k) => measurements[k as keyof Measurements] != null);

  function fillDemo() {
    setName((n) => n || "Perfil Demonstração");
    setValues({
      height: String(DEMO.height), weight: String(DEMO.weight), chest: String(DEMO.chest),
      waist: String(DEMO.waist), hip: String(DEMO.hip), shoulder: String(DEMO.shoulder),
    });
  }

  async function submit(goToPhoto: boolean) {
    setSaving(true);
    setError(null);
    try {
      let saved;
      if (user) {
        await api.updateUser(user.id, { name: name.trim(), fit_preference: preference, photo_consent: consent });
        await api.putMeasurements(user.id, measurements);
        saved = await api.getUser(user.id);
      } else {
        saved = await api.createUser({ name: name.trim(), fit_preference: preference, photo_consent: consent, measurements });
      }
      setUser(saved);
      router.push(goToPhoto ? "/consumidor/foto" : "/catalogo");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível salvar. Verifique se a API está em execução.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <form
        className="space-y-8 rounded-3xl border border-border bg-paper p-6 shadow-soft sm:p-8"
        onSubmit={(e) => {
          e.preventDefault();
          void submit(consent);
        }}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex-1 space-y-2">
            <Label htmlFor="name">Como podemos te chamar?</Label>
            <Input id="name" placeholder="Seu nome" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <Button type="button" variant="soft" size="sm" onClick={fillDemo}>
            <Wand2 /> Preencher perfil demo
          </Button>
        </div>

        <div>
          <div className="mb-4 flex items-center justify-between">
            <p className="font-medium">Medidas corporais</p>
            <span className="text-xs text-stone">{Math.round(completeness)}% preenchido</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FIELDS.map((field) => (
              <div key={field.key} className="space-y-2">
                <Label htmlFor={field.key} className="flex items-center gap-1.5">
                  {field.label}
                  <span className="text-stone/70">({field.unit})</span>
                </Label>
                <Input
                  id={field.key}
                  inputMode="decimal"
                  placeholder={String(DEMO[field.key])}
                  value={values[field.key]}
                  onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
                />
                <p className="text-[11.5px] text-stone">{field.hint}</p>
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-3 font-medium">Preferência de caimento</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {(["tight", "regular", "loose"] as FitPreference[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPreference(p)}
                className={cn(
                  "rounded-2xl border p-4 text-left transition-all",
                  preference === p ? "border-ink bg-ink text-ivory shadow-soft" : "border-border bg-paper hover:border-ink/30",
                )}
                aria-pressed={preference === p}
              >
                <p className="font-medium">{FIT_PREFERENCE_LABEL[p]}</p>
                <p className={cn("mt-1 text-xs", preference === p ? "text-ivory/70" : "text-stone")}>{PREF_DESCRIPTION[p]}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-start justify-between gap-4 rounded-2xl bg-ivory p-4">
          <div className="flex gap-3">
            <Camera className="mt-0.5 size-4 shrink-0 text-stone" />
            <div>
              <p className="text-sm font-medium">Autorizo a análise experimental de uma foto</p>
              <p className="mt-1 text-xs leading-relaxed text-stone">
                Opcional. A imagem é usada apenas como enriquecimento da estimativa de proporções, processada em memória e
                descartada. Sem reconhecimento facial, sem classificação estética.
              </p>
            </div>
          </div>
          <Switch checked={consent} onCheckedChange={setConsent} aria-label="Consentimento para análise de foto" />
        </div>

        {error ? <p className="rounded-xl bg-clay/10 px-4 py-3 text-sm text-clay">{error}</p> : null}

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" disabled={!canSubmit || saving} onClick={() => submit(false)}>
            Continuar sem foto
          </Button>
          <Button type="submit" disabled={!canSubmit || saving}>
            {saving ? "Salvando…" : consent ? "Salvar e enviar foto" : "Salvar e ir ao catálogo"} <ArrowRight />
          </Button>
        </div>
      </form>

      <aside className="space-y-5">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl border border-border bg-paper p-6 shadow-soft"
        >
          <p className="eyebrow">Como medir</p>
          <BodyGuide />
          <ul className="mt-4 space-y-2 text-[13px] leading-relaxed text-stone">
            <li>Use uma fita métrica flexível, sem apertar.</li>
            <li>Meça sobre roupas leves ou diretamente no corpo.</li>
            <li>Peito, cintura e quadril são circunferências completas.</li>
          </ul>
        </motion.div>
        <div className="flex gap-3 rounded-3xl border border-border bg-ivory p-5 text-[13px] leading-relaxed text-stone">
          <Info className="mt-0.5 size-4 shrink-0" />
          <p>
            Medidas incompletas reduzem o nível de confiança em vez de inventar precisão. Você pode atualizar seus dados a
            qualquer momento.
          </p>
        </div>
      </aside>
    </div>
  );
}

function BodyGuide() {
  const lines = [
    { y: 230, label: "Ombros", color: "var(--ink)" },
    { y: 280, label: "Peito", color: "var(--terracotta)" },
    { y: 363, label: "Cintura", color: "var(--amber)" },
    { y: 516, label: "Quadril", color: "var(--sage)" },
  ];

  return (
    <div className="relative mx-auto mt-2 flex h-[min(640px,68vh)] w-full justify-center gap-2" aria-hidden="true">
      <div className="relative h-full w-[14.5rem] shrink-0">
        <img
          src="/images/body-silhouette.png"
          alt=""
          className="pointer-events-none absolute inset-0 h-full w-full object-contain object-center opacity-[0.38]"
          style={{ mixBlendMode: "multiply" }}
        />
        <svg viewBox="0 0 352 1024" className="absolute inset-0 h-full w-full">
          {lines.map((l) => (
            <line
              key={l.label}
              x1="52"
              x2="300"
              y1={l.y}
              y2={l.y}
              stroke={l.color}
              strokeWidth="3"
              strokeDasharray="8 8"
            />
          ))}
        </svg>
      </div>
      <div className="relative h-full w-12 shrink-0">
        {lines.map((l) => (
          <span
            key={l.label}
            className="absolute left-0 -translate-y-1/2 text-[13px] leading-none"
            style={{ top: `${(l.y / 1024) * 100}%`, color: l.color }}
          >
            {l.label}
          </span>
        ))}
      </div>
    </div>
  );
}
