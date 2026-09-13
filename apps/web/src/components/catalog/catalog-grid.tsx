"use client";

import * as React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import type { Category, ProductSummary } from "@veste-ai/contracts";
import { CATEGORY_LABEL } from "@veste-ai/contracts";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { ProductCard } from "./product-card";

const ORDER: Category[] = ["tshirt", "shirt", "polo", "hoodie", "jacket", "dress", "pants", "shorts"];

export function CatalogGrid({ initial }: { initial: ProductSummary[] | null }) {
  const [products, setProducts] = React.useState<ProductSummary[] | null>(initial);
  const [error, setError] = React.useState<boolean>(initial === null);
  const [filter, setFilter] = React.useState<Category | "all">("all");

  const load = React.useCallback(async () => {
    setError(false);
    try {
      setProducts(await api.listProducts());
    } catch {
      setError(true);
    }
  }, []);

  React.useEffect(() => {
    if (initial === null) void load();
  }, [initial, load]);

  const categories = React.useMemo(() => {
    const present = new Set(products?.map((p) => p.category) ?? []);
    return ORDER.filter((c) => present.has(c));
  }, [products]);

  const visible = products?.filter((p) => filter === "all" || p.category === filter) ?? [];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap gap-2">
        <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>
          Todos {products ? <span className="text-stone">({products.length})</span> : null}
        </FilterChip>
        {categories.map((c) => (
          <FilterChip key={c} active={filter === c} onClick={() => setFilter(c)}>
            {CATEGORY_LABEL[c]}
          </FilterChip>
        ))}
      </div>

      {error ? (
        <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-border bg-paper p-12 text-center">
          <AlertTriangle className="size-6 text-amber" />
          <p className="font-medium">Não foi possível carregar o catálogo.</p>
          <p className="max-w-sm text-sm text-stone">
            Verifique se a API está em execução em <code className="font-mono">{process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}</code>.
          </p>
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw /> Tentar novamente
          </Button>
        </div>
      ) : !products ? (
        <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="aspect-[4/5] w-full rounded-3xl" />
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-5 w-2/3" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visible.map((p, i) => (
            <ProductCard key={p.id} product={p} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-4 py-2 text-[13px] font-medium transition-all",
        active ? "border-ink bg-ink text-ivory" : "border-border bg-paper text-ink hover:border-ink/40",
      )}
    >
      {children}
    </button>
  );
}
