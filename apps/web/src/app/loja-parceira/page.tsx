import type { Metadata } from "next";
import type { ProductSummary } from "@veste-ai/contracts";
import { api } from "@/lib/api";
import { PartnerProductsGrid } from "@/components/partner/products-grid";
import { PartnerStoreShell } from "@/components/partner/store-shell";

export const metadata: Metadata = { title: "ATELIER NORTE" };
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
        <div className="mx-auto max-w-6xl px-5 py-16 md:py-24">
          <p className="text-[11px] uppercase tracking-[0.22em] text-[#c9a46a]">Coleção permanente</p>
          <h1 className="mt-4 max-w-3xl font-display text-5xl leading-[0.95] md:text-6xl">
            Essenciais para o dia a dia, com caimento certo.
          </h1>
          <p className="mt-6 max-w-xl text-[15px] leading-relaxed text-white/65">
            Camisetas, camisas, calças e peças de sobreposição selecionadas para compor um guarda-roupa
            versátil — do escritório ao fim de semana.
          </p>
          <div className="mt-10 flex flex-wrap gap-6 text-[11px] uppercase tracking-[0.14em] text-white/40">
            <span>Frete grátis acima de R$ 299</span>
            <span>·</span>
            <span>Trocas em 30 dias</span>
            <span>·</span>
            <span>Parcelamento em 6x</span>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-14">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Novidades</p>
            <h2 className="mt-2 font-display text-3xl">Todos os produtos</h2>
          </div>
          {products.length > 0 ? (
            <p className="text-xs text-white/40">{products.length} itens</p>
          ) : null}
        </div>

        <PartnerProductsGrid initial={products} />
      </section>
    </PartnerStoreShell>
  );
}
