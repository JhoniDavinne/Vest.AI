import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { ProductSummary } from "@veste-ai/contracts";
import { CATEGORY_LABEL, MODELING_LABEL } from "@veste-ai/contracts";
import { api } from "@/lib/api";
import { formatPrice } from "@/lib/utils";
import { PartnerStoreShell } from "@/components/partner/store-shell";

export const metadata: Metadata = { title: "ATELIER NORTE · Loja parceira" };
export const dynamic = "force-dynamic";

export default async function PartnerStorePage() {
  let products: ProductSummary[] = [];
  try {
    products = await api.listProducts();
  } catch {
    products = [];
  }

  return (
    <PartnerStoreShell>
      <section className="border-b border-white/10">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 md:grid-cols-[1.1fr_0.9fr] md:py-24">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-[#c9a46a]">Coleção permanente</p>
            <h1 className="mt-4 font-display text-5xl leading-[0.95] md:text-6xl">
              Peças com ficha técnica.
              <br />
              Tamanho com dados.
            </h1>
            <p className="mt-6 max-w-xl text-[15px] leading-relaxed text-white/65">
              Esta não é a VESTE.AI — é uma loja fictícia que incorpora o widget. O botão “Descubra seu tamanho
              ideal” consulta o mesmo motor da aplicação própria.
            </p>
          </div>
          <div className="self-end rounded-3xl border border-white/10 bg-white/5 p-6">
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Integração</p>
            <p className="mt-2 font-display text-2xl">powered by VESTE.AI</p>
            <p className="mt-2 text-sm leading-relaxed text-white/60">
              SKU + medidas do consumidor → POST /api/v1/recommendations → tamanho, score e justificativa.
            </p>
            <Link
              href="/empresa/widget"
              className="mt-5 inline-flex items-center gap-2 text-sm text-[#c9a46a] hover:text-[#e2c48a]"
            >
              Ver o Studio do widget <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-14">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Catálogo</p>
            <h2 className="mt-2 font-display text-3xl">Escolha uma peça</h2>
          </div>
          <p className="text-xs text-white/40">{products.length} produtos com widget</p>
        </div>

        {products.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-white/15 p-10 text-center text-sm text-white/50">
            API indisponível. Inicie o backend para carregar a coleção da loja parceira.
          </div>
        ) : (
          <div className="grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((product) => (
              <Link key={product.id} href={`/loja-parceira/produto/${product.slug}`} className="group">
                <div className="overflow-hidden rounded-3xl border border-white/10 bg-[#171b18]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="aspect-[4/5] w-full object-cover transition duration-700 group-hover:scale-[1.03]"
                  />
                </div>
                <div className="mt-4 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.16em] text-white/40">{product.brand}</p>
                    <h3 className="mt-1 font-display text-lg">{product.name}</h3>
                    <p className="mt-1 text-xs text-white/45">
                      {CATEGORY_LABEL[product.category]} · {MODELING_LABEL[product.modeling]}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm">{formatPrice(product.price_cents)}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </PartnerStoreShell>
  );
}
