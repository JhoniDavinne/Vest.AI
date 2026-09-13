import type { Metadata } from "next";
import type { ProductSummary } from "@veste-ai/contracts";
import { api } from "@/lib/api";
import { SiteShell, PageIntro } from "@/components/site/shell";
import { CatalogGrid } from "@/components/catalog/catalog-grid";
import { Steps } from "@/components/consumer/steps";

export const metadata: Metadata = { title: "Catálogo" };
export const dynamic = "force-dynamic";

export default async function CatalogPage() {
  let initial: ProductSummary[] | null = null;
  try {
    initial = await api.listProducts();
  } catch {
    initial = null; // o grid tenta novamente no cliente
  }
  return (
    <SiteShell>
      <PageIntro
        eyebrow="Consumidor · Passo 3 de 3"
        title="Escolha uma peça e analise o caimento."
        description="Cada produto possui ficha técnica com medidas reais por tamanho. Selecione um item para ver a recomendação calculada pelo motor VESTE.AI."
        actions={<Steps current={3} />}
      />
      <div className="container-veste pb-24">
        <CatalogGrid initial={initial} />
      </div>
    </SiteShell>
  );
}
