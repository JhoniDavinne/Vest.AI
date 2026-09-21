"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Plus, Trash2, Wand2 } from "lucide-react";
import type { Category, GarmentMeasurement, Modeling, ProductCreate } from "@veste-ai/contracts";
import { CATEGORY_LABEL, MODELING_LABEL } from "@veste-ai/contracts";
import { api, ApiError, DEMO_API_KEY } from "@/lib/api";
import { ProductImagesField } from "@/components/studio/product-image-field";
import { StudioHeader } from "@/components/studio/studio-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/misc";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type SizeRow = { size_label: string; sku: string } & Record<keyof GarmentMeasurement, string>;

const MEASURE_KEYS: (keyof GarmentMeasurement)[] = ["chest", "waist", "hip", "shoulder", "length", "sleeve", "width"];
const MEASURE_LABEL: Record<keyof GarmentMeasurement, string> = {
  chest: "Peito", waist: "Cintura", hip: "Quadril", shoulder: "Ombro", length: "Comprimento", sleeve: "Manga", width: "Largura",
};

const emptyRow = (label = ""): SizeRow => ({
  size_label: label, sku: "", chest: "", waist: "", hip: "", shoulder: "", length: "", sleeve: "", width: "",
});

export default function NewProductPage() {
  const router = useRouter();
  const [form, setForm] = React.useState({
    name: "", brand: "", category: "tshirt" as Category, modeling: "regular" as Modeling, audience: "unissex",
    description: "", color: "", price: "", fabric: "", composition: "", elasticity_pct: "5", care: "", images: [] as string[],
  });
  const [rows, setRows] = React.useState<SizeRow[]>([emptyRow("S"), emptyRow("M"), emptyRow("L")]);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [created, setCreated] = React.useState<{ slug: string; id: string } | null>(null);

  function fillExample() {
    setForm({
      name: "Camiseta Linho Leve", brand: "Loja Parceira", category: "tshirt", modeling: "relaxed", audience: "unissex",
      description: "Camiseta em malha de linho com caimento relaxed e toque fresco.", color: "Areia", price: "159,90",
      fabric: "Malha de linho", composition: "55% linho, 45% algodão", elasticity_pct: "3", care: "Lavar à mão.", images: [],
    });
    setRows([
      { ...emptyRow("S"), chest: "108", waist: "108", hip: "106", shoulder: "45", length: "70", sleeve: "22", width: "54" },
      { ...emptyRow("M"), chest: "114", waist: "114", hip: "112", shoulder: "46.5", length: "72", sleeve: "23", width: "57" },
      { ...emptyRow("L"), chest: "120", waist: "120", hip: "118", shoulder: "48", length: "74", sleeve: "24", width: "60" },
      { ...emptyRow("XL"), chest: "126", waist: "126", hip: "124", shoulder: "49.5", length: "76", sleeve: "25", width: "63" },
    ]);
  }

  const num = (v: string) => (v.trim() === "" ? null : Number(v.replace(",", ".")));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const payload: ProductCreate = {
      name: form.name, brand: form.brand, category: form.category, modeling: form.modeling, audience: form.audience,
      description: form.description, color: form.color, fabric: form.fabric, composition: form.composition, care: form.care,
      images: form.images.length > 0 ? form.images : undefined,
      image_url: form.images[0],
      price_cents: Math.round((num(form.price) ?? 0) * 100),
      elasticity_pct: num(form.elasticity_pct) ?? 3,
      sizes: rows
        .filter((r) => r.size_label.trim())
        .map((r) => ({
          size_label: r.size_label.trim(),
          sku: r.sku.trim() || undefined,
          measurements: Object.fromEntries(MEASURE_KEYS.map((k) => [k, num(r[k])])) as GarmentMeasurement,
        })),
    };
    try {
      const product = await api.createProduct(payload, DEMO_API_KEY);
      setCreated({ slug: product.slug, id: product.id });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível cadastrar.");
    } finally {
      setSaving(false);
    }
  }

  if (created) {
    return (
      <div className="mx-auto max-w-xl rounded-3xl border border-border bg-paper p-10 text-center shadow-soft">
        <CheckCircle2 className="mx-auto size-10 text-sage" />
        <h1 className="mt-4 text-2xl font-medium">Produto cadastrado</h1>
        <p className="mt-2 text-sm text-stone">Os SKUs e medidas já estão disponíveis para o motor de recomendação, para o catálogo e para o widget.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button asChild><Link href={`/catalogo/${created.slug}`}>Ver na loja</Link></Button>
          <Button asChild variant="outline"><Link href={`/loja-parceira/produto/${created.slug}`}>Ver com widget</Link></Button>
          <Button variant="ghost" onClick={() => router.push("/empresa/produtos")}>Voltar à lista</Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <StudioHeader
        eyebrow="Catálogo"
        title="Cadastrar produto"
        description="Informe os dados técnicos da peça e as medidas por tamanho. Estes dados são a base da comparação pessoa × peça."
        actions={
          <Button type="button" variant="soft" onClick={fillExample}>
            <Wand2 /> Preencher exemplo
          </Button>
        }
      />
      <form onSubmit={submit} className="space-y-8">
        <section className="rounded-3xl border border-border bg-paper p-6 shadow-soft">
          <p className="eyebrow mb-4">Produto</p>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Field label="Nome"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></Field>
            <Field label="Marca"><Input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} required /></Field>
            <Field label="Categoria">
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v as Category })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(CATEGORY_LABEL) as Category[]).map((c) => <SelectItem key={c} value={c}>{CATEGORY_LABEL[c]}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Modelagem">
              <Select value={form.modeling} onValueChange={(v) => setForm({ ...form, modeling: v as Modeling })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(MODELING_LABEL) as Modeling[]).map((m) => <SelectItem key={m} value={m}>{MODELING_LABEL[m]}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Público"><Input value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })} /></Field>
            <Field label="Cor"><Input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} /></Field>
            <Field label="Preço (R$)"><Input inputMode="decimal" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></Field>
            <Field label="Tecido"><Input value={form.fabric} onChange={(e) => setForm({ ...form, fabric: e.target.value })} /></Field>
            <Field label="Composição"><Input value={form.composition} onChange={(e) => setForm({ ...form, composition: e.target.value })} placeholder="ex.: 95% algodão, 5% elastano" /></Field>
            <Field label="Elasticidade (%) — heurística"><Input inputMode="decimal" value={form.elasticity_pct} onChange={(e) => setForm({ ...form, elasticity_pct: e.target.value })} /></Field>
            <Field label="Cuidados"><Input value={form.care} onChange={(e) => setForm({ ...form, care: e.target.value })} /></Field>
            <div className="md:col-span-2 lg:col-span-3">
              <Field label="Descrição"><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
            </div>
            <div className="md:col-span-2 lg:col-span-3">
              <ProductImagesField
                value={form.images}
                onChange={(images) => setForm({ ...form, images })}
                apiKey={DEMO_API_KEY}
              />
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-border bg-paper p-6 shadow-soft">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="eyebrow">Tamanhos / SKUs</p>
              <p className="mt-1 text-xs text-stone">Circunferências em cm. Deixe em branco o que não se aplica (ex.: peito em calças).</p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => setRows((r) => [...r, emptyRow()])}>
              <Plus /> Adicionar tamanho
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-[0.14em] text-stone">
                  <th className="px-2 py-2">Tamanho</th>
                  <th className="px-2 py-2">SKU (opcional)</th>
                  {MEASURE_KEYS.map((k) => <th key={k} className="px-2 py-2">{MEASURE_LABEL[k]}</th>)}
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i}>
                    <td className="px-2 py-1"><Input className="h-10 w-20" value={row.size_label} onChange={(e) => update(i, "size_label", e.target.value)} /></td>
                    <td className="px-2 py-1"><Input className="h-10 w-36 font-mono text-xs" value={row.sku} onChange={(e) => update(i, "sku", e.target.value)} placeholder="auto" /></td>
                    {MEASURE_KEYS.map((k) => (
                      <td key={k} className="px-2 py-1">
                        <Input className="h-10 w-20" inputMode="decimal" value={row[k]} onChange={(e) => update(i, k, e.target.value)} />
                      </td>
                    ))}
                    <td className="px-2 py-1">
                      <button type="button" onClick={() => setRows((r) => r.filter((_, j) => j !== i))} className="rounded-lg p-2 text-stone hover:bg-ivory hover:text-clay" aria-label="Remover">
                        <Trash2 className="size-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {error ? <p className="rounded-xl bg-clay/10 px-4 py-3 text-sm text-clay">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <Button asChild variant="ghost"><Link href="/empresa/produtos">Cancelar</Link></Button>
          <Button type="submit" disabled={saving}>{saving ? "Salvando…" : "Cadastrar produto"}</Button>
        </div>
      </form>
    </>
  );

  function update(index: number, key: keyof SizeRow, value: string) {
    setRows((r) => r.map((row, i) => (i === index ? { ...row, [key]: value } : row)));
  }
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
