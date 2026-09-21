"use client";

import * as React from "react";
import Link from "next/link";
import type { ProductSummary } from "@veste-ai/contracts";
import { CATEGORY_LABEL, MODELING_LABEL } from "@veste-ai/contracts";
import { api } from "@/lib/api";
import { formatPrice } from "@/lib/utils";
import { Skeleton } from "@/components/ui/misc";

export function PartnerProductsGrid({ initial }: { initial: ProductSummary[] }) {
  const [products, setProducts] = React.useState(initial);
  const [loading, setLoading] = React.useState(initial.length === 0);
  const [error, setError] = React.useState(false);

  React.useEffect(() => {
    if (initial.length > 0) return;

    let cancelled = false;
    void (async () => {
      try {
        const items = await api.listProducts();
        if (cancelled) return;
        setProducts(items);
        setError(items.length === 0);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [initial.length]);

  if (loading) {
    return (
      <div className="grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="space-y-4">
            <Skeleton className="aspect-[4/5] w-full rounded-3xl bg-white/10" />
            <Skeleton className="h-4 w-2/3 bg-white/10" />
            <Skeleton className="h-3 w-1/2 bg-white/10" />
          </div>
        ))}
      </div>
    );
  }

  if (error || products.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-white/15 p-10 text-center text-sm text-white/50">
        Não foi possível carregar a coleção no momento. Tente novamente em instantes.
      </div>
    );
  }

  return (
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
  );
}
