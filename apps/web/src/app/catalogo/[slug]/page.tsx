import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Layers, Scissors, Shirt, Waves } from "lucide-react";
import { CATEGORY_LABEL, MODELING_LABEL } from "@veste-ai/contracts";
import { api } from "@/lib/api";
import { formatPrice } from "@/lib/utils";
import { SiteShell } from "@/components/site/shell";
import { AnalyzeCta } from "@/components/catalog/analyze-cta";
import { CatalogFitPreviewSection } from "@/components/catalog/catalog-fit-preview-section";
import { ProductImageCarousel } from "@/components/catalog/product-image-carousel";
import { SizeTable } from "@/components/catalog/size-table";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  try {
    const product = await api.getProduct(slug);
    return { title: product.name };
  } catch {
    return { title: "Produto" };
  }
}

export default async function ProductPage({ params }: { params: Params }) {
  const { slug } = await params;
  let product;
  try {
    product = await api.getProduct(slug);
  } catch {
    notFound();
  }

  const specs = [
    { icon: Scissors, label: "Modelagem", value: MODELING_LABEL[product.modeling] },
    { icon: Layers, label: "Tecido", value: product.fabric },
    { icon: Waves, label: "Elasticidade", value: `${product.elasticity_pct}% (heurística)` },
    { icon: Shirt, label: "Composição", value: product.composition },
  ];

  return (
    <SiteShell>
      <div className="container-veste pt-8">
        <Link href="/catalogo" className="inline-flex items-center gap-2 text-sm text-stone hover:text-ink">
          <ArrowLeft className="size-4" /> Voltar ao catálogo
        </Link>
      </div>
      <div className="container-veste grid gap-12 py-10 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="lg:sticky lg:top-24 lg:self-start">
          <ProductImageCarousel
            images={product.images?.length ? product.images : [product.image_url]}
            videoUrl={product.video_url}
            alt={product.name}
          />
        </div>

        <div className="space-y-8">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{CATEGORY_LABEL[product.category]}</Badge>
              <Badge variant="secondary">{product.audience}</Badge>
              <Badge variant="accent">{MODELING_LABEL[product.modeling]}</Badge>
            </div>
            <div>
              <p className="eyebrow">{product.brand}</p>
              <h1 className="mt-2 text-4xl font-medium leading-tight md:text-5xl">{product.name}</h1>
            </div>
            <div className="flex items-baseline gap-3">
              <p className="font-display text-2xl">{formatPrice(product.price_cents)}</p>
              <p className="text-sm text-stone">Cor: {product.color}</p>
            </div>
            <p className="text-[15px] leading-relaxed text-stone">{product.description}</p>
          </div>

          <div className="rounded-3xl border border-border bg-paper p-6 shadow-soft">
            <AnalyzeCta product={product} />
          </div>

          <CatalogFitPreviewSection product={product} />

          <div className="grid gap-3 sm:grid-cols-2">
            {specs.map((s) => (
              <div key={s.label} className="flex items-start gap-3 rounded-2xl border border-border bg-paper p-4">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-ivory">
                  <s.icon className="size-4 text-stone" />
                </span>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-stone">{s.label}</p>
                  <p className="mt-0.5 text-sm font-medium">{s.value}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-medium">Ficha técnica por tamanho</h2>
              <span className="text-xs text-stone">{product.sizes.length} SKUs</span>
            </div>
            <SizeTable sizes={product.sizes} />
            <p className="text-xs text-stone">Cuidados: {product.care}</p>
          </div>
        </div>
      </div>
    </SiteShell>
  );
}
