"use client";

import * as React from "react";
import type { Product } from "@veste-ai/contracts";
import { api, ApiError, DEMO_API_KEY } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { ProductImagesField } from "./product-image-field";

export function ProductImagesEditor({
  product,
  onSaved,
}: {
  product: Product;
  onSaved?: (images: string[]) => void;
}) {
  const [images, setImages] = React.useState(product.images?.length ? product.images : [product.image_url]);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);

  React.useEffect(() => {
    setImages(product.images?.length ? product.images : [product.image_url]);
  }, [product.id, product.image_url, product.images]);

  async function save() {
    if (images.length === 0) {
      setError("Adicione pelo menos uma imagem.");
      return;
    }
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const updated = await api.updateProductImages(product.id, images, DEMO_API_KEY);
      const next = updated.images?.length ? updated.images : [updated.image_url];
      setImages(next);
      setSaved(true);
      onSaved?.(next);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível salvar as imagens.");
    } finally {
      setSaving(false);
    }
  }

  const dirty =
    images.length !== (product.images?.length ?? 1) ||
    images.some((url, index) => url !== (product.images?.[index] ?? product.image_url));

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-paper p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">Galeria de fotos</p>
        {saved && !dirty ? <span className="text-xs text-sage">Salvo</span> : null}
      </div>
      <ProductImagesField value={images} onChange={setImages} apiKey={DEMO_API_KEY} />
      {error ? <p className="text-sm text-clay">{error}</p> : null}
      <div className="flex justify-end">
        <Button type="button" size="sm" disabled={saving || !dirty} onClick={() => void save()}>
          {saving ? "Salvando…" : "Salvar imagens"}
        </Button>
      </div>
    </div>
  );
}
