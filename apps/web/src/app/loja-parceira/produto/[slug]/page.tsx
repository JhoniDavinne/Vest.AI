import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { CATEGORY_LABEL, MODELING_LABEL } from "@veste-ai/contracts";
import { api } from "@/lib/api";
import { formatPrice } from "@/lib/utils";
import { PartnerStoreShell } from "@/components/partner/store-shell";
import { PartnerProductWidget } from "@/components/partner/product-widget";

export const dynamic = "force-dynamic";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  try {
    const product = await api.getProduct(slug);
    return { title: `${product.name} · ATELIER NORTE` };
  } catch {
    return { title: "Produto · ATELIER NORTE" };
  }
}

export default async function PartnerProductPage({ params }: { params: Params }) {
  const { slug } = await params;
  let product;
  try {
    product = await api.getProduct(slug);
  } catch {
    notFound();
  }

  const mid = product.sizes[Math.floor(product.sizes.length / 2)];

  return (
    <PartnerStoreShell>
      <div className="mx-auto max-w-6xl px-5 pt-8">
        <Link href="/loja-parceira" className="inline-flex items-center gap-2 text-sm text-white/55 hover:text-white">
          <ArrowLeft className="size-4" /> Voltar à coleção
        </Link>
      </div>
      <div className="mx-auto grid max-w-6xl gap-12 px-5 py-10 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="overflow-hidden rounded-[32px] border border-white/10 bg-[#171b18]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={product.image_url} alt={product.name} className="aspect-[4/5] w-full object-cover" />
        </div>
        <div className="space-y-8">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-[#c9a46a]">{product.brand}</p>
            <h1 className="mt-2 font-display text-4xl leading-tight md:text-5xl">{product.name}</h1>
            <p className="mt-4 text-lg">{formatPrice(product.price_cents)}</p>
            <p className="mt-3 text-sm leading-relaxed text-white/60">{product.description}</p>
            <p className="mt-4 text-xs text-white/40">
              {CATEGORY_LABEL[product.category]} · {MODELING_LABEL[product.modeling]} · {product.composition} ·
              elasticidade {product.elasticity_pct}%
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {product.available_sizes.map((size) => (
              <span key={size} className="rounded-full border border-white/15 px-3 py-1 text-xs text-white/75">
                {size}
              </span>
            ))}
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Provador inteligente</p>
            <h2 className="mt-2 font-display text-2xl">Descubra seu tamanho ideal</h2>
            <p className="mt-2 text-sm leading-relaxed text-white/60">
              O botão abaixo é o widget VESTE.AI. Ele não calcula nada nesta página: envia as medidas para a API e
              devolve o tamanho recomendado com score e justificativa.
            </p>
            <div className="mt-5">
              <PartnerProductWidget productId={product.slug} sku={mid?.sku} />
            </div>
          </div>

          <p className="text-xs text-white/35">
            Esta loja é uma simulação B2B. Para ver o mesmo produto na aplicação VESTE.AI,{" "}
            <Link href={`/catalogo/${product.slug}`} className="underline underline-offset-2">
              abra o catálogo próprio
            </Link>
            .
          </p>
        </div>
      </div>
    </PartnerStoreShell>
  );
}
