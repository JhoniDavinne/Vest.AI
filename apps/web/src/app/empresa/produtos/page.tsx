"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import type { Product, ProductSummary } from "@veste-ai/contracts";
import { CATEGORY_LABEL, MODELING_LABEL } from "@veste-ai/contracts";
import { api, ApiError, DEMO_API_KEY } from "@/lib/api";
import { formatPrice } from "@/lib/utils";
import { StudioHeader } from "@/components/studio/studio-shell";
import { SizeTable } from "@/components/catalog/size-table";
import { ProductImagesEditor } from "@/components/studio/product-images-editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/misc";

export default function StudioProducts() {
  const [products, setProducts] = React.useState<ProductSummary[] | null>(null);
  const [expanded, setExpanded] = React.useState<string | null>(null);
  const [details, setDetails] = React.useState<Record<string, Product>>({});
  const [deleteTarget, setDeleteTarget] = React.useState<ProductSummary | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);

  React.useEffect(() => {
    api.listProducts().then(setProducts).catch(() => setProducts([]));
  }, []);

  async function toggle(id: string) {
    if (expanded === id) {
      setExpanded(null);
      return;
    }
    setExpanded(id);
    if (!details[id]) {
      const product = await api.getProduct(id);
      setDetails((d) => ({ ...d, [id]: product }));
    }
  }

  function openDeleteDialog(product: ProductSummary) {
    setDeleteError(null);
    setDeleteTarget(product);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await api.deleteProduct(deleteTarget.id, DEMO_API_KEY);
      setProducts((list) => list?.filter((item) => item.id !== deleteTarget.id) ?? null);
      setDetails((d) => {
        const next = { ...d };
        delete next[deleteTarget.id];
        return next;
      });
      if (expanded === deleteTarget.id) {
        setExpanded(null);
      }
      setDeleteTarget(null);
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : "Não foi possível excluir o produto.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <StudioHeader
        eyebrow="Catálogo"
        title="Produtos & SKUs"
        description="Cada produto possui SKUs por tamanho com medidas técnicas, tecido, composição e elasticidade — os dados que alimentam o motor."
        actions={
          <Button asChild>
            <Link href="/empresa/produtos/novo">
              <Plus /> Cadastrar produto
            </Link>
          </Button>
        }
      />

      {!products ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {products.map((p) => (
            <div key={p.id} className="overflow-hidden rounded-2xl border border-border bg-paper shadow-soft">
              <button type="button" onClick={() => toggle(p.id)} className="flex w-full items-center gap-4 p-4 text-left">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.image_url} alt="" className="size-16 rounded-xl object-cover" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{p.name}</p>
                    <Badge variant="outline">{CATEGORY_LABEL[p.category]}</Badge>
                    <Badge variant="secondary">{MODELING_LABEL[p.modeling]}</Badge>
                  </div>
                  <p className="mt-1 truncate text-xs text-stone">
                    {p.brand} · {p.composition} · elasticidade {p.elasticity_pct}% · {formatPrice(p.price_cents)}
                  </p>
                </div>
                <div className="hidden items-center gap-1.5 sm:flex">
                  {p.available_sizes.map((s) => (
                    <span key={s} className="rounded-md border border-border px-2 py-0.5 text-[11px]">
                      {s}
                    </span>
                  ))}
                </div>
                <ChevronDown className={`size-4 text-stone transition ${expanded === p.id ? "rotate-180" : ""}`} />
              </button>
              {expanded === p.id ? (
                <div className="space-y-4 border-t border-border bg-ivory/50 p-4">
                  {details[p.id] ? (
                    <>
                      <ProductImagesEditor
                        product={details[p.id]}
                        onSaved={(images) => {
                          setProducts((list) =>
                            list?.map((item) =>
                              item.id === p.id ? { ...item, image_url: images[0], images } : item,
                            ) ?? null,
                          );
                          setDetails((d) => ({
                            ...d,
                            [p.id]: { ...d[p.id], image_url: images[0], images },
                          }));
                        }}
                      />
                      <SizeTable sizes={details[p.id].sizes} />
                    </>
                  ) : (
                    <Skeleton className="h-32" />
                  )}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap gap-2 text-xs">
                      <Link href={`/catalogo/${p.slug}`} className="text-ink underline underline-offset-2">
                        Ver na loja VESTE.AI
                      </Link>
                      <span className="text-stone">·</span>
                      <Link href={`/loja-parceira/produto/${p.slug}`} className="text-ink underline underline-offset-2">
                        Ver na loja parceira (widget)
                      </Link>
                      <span className="text-stone">·</span>
                      <Link href={`/empresa/api?sku=${p.available_sizes[Math.floor(p.available_sizes.length / 2)] ? `${details[p.id]?.sizes[Math.floor(p.available_sizes.length / 2)]?.sku ?? ""}` : ""}`} className="text-ink underline underline-offset-2">
                        Testar via API
                      </Link>
                    </div>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => openDeleteDialog(p)}
                    >
                      <Trash2 />
                      Excluir produto
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}

      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && !deleting && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir produto?</DialogTitle>
            <DialogDescription>
              {deleteTarget
                ? `“${deleteTarget.name}” será removido do catálogo e não aparecerá mais na loja. Análises de provador já realizadas são preservadas.`
                : null}
            </DialogDescription>
          </DialogHeader>
          {deleteError ? <p className="text-sm text-clay">{deleteError}</p> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" disabled={deleting} onClick={() => setDeleteTarget(null)}>
              Cancelar
            </Button>
            <Button type="button" variant="destructive" disabled={deleting} onClick={confirmDelete}>
              {deleting ? "Excluindo…" : "Excluir"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
