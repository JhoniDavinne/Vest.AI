"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, ImagePlus, Link2, Loader2, Star, X } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ProductImagesFieldProps = {
  value: string[];
  onChange: (urls: string[]) => void;
  apiKey?: string;
};

export function ProductImagesField({ value, onChange, apiKey }: ProductImagesFieldProps) {
  const [mode, setMode] = React.useState<"upload" | "url">("upload");
  const [dragging, setDragging] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [uploadTotal, setUploadTotal] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const [urlDraft, setUrlDraft] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);
  const valueRef = React.useRef(value);

  React.useEffect(() => {
    valueRef.current = value;
  }, [value]);

  async function uploadMany(files: File[]) {
    const valid = files.filter((file) => file.type.startsWith("image/"));
    if (valid.length === 0) {
      setError("Selecione arquivos de imagem (JPG, PNG ou WebP).");
      return;
    }

    setUploading(true);
    setUploadTotal(valid.length);
    setError(null);

    try {
      const results = await Promise.all(valid.map((file) => api.uploadProductImage(file, apiKey)));
      const urls = results.map((result) => result.image_url);
      onChange([...valueRef.current, ...urls]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível enviar as imagens.");
    } finally {
      setUploading(false);
      setUploadTotal(0);
    }
  }

  function applyUrl() {
    const trimmed = urlDraft.trim();
    if (!trimmed) {
      setError("Informe a URL da imagem.");
      return;
    }
    setError(null);
    onChange([...value, trimmed]);
    setUrlDraft("");
  }

  function removeAt(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  function move(index: number, direction: -1 | 1) {
    const next = index + direction;
    if (next < 0 || next >= value.length) return;
    const copy = [...value];
    [copy[index], copy[next]] = [copy[next], copy[index]];
    onChange(copy);
  }

  function setCover(index: number) {
    if (index === 0) return;
    const copy = [...value];
    const [cover] = copy.splice(index, 1);
    onChange([cover, ...copy]);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label>Fotos da peça ({value.length})</Label>
        <div className="flex gap-1 rounded-full bg-ivory p-1 text-xs">
          <button
            type="button"
            className={cn("rounded-full px-3 py-1", mode === "upload" ? "bg-paper shadow-sm" : "text-stone")}
            onClick={() => setMode("upload")}
          >
            Enviar arquivo
          </button>
          <button
            type="button"
            className={cn("rounded-full px-3 py-1", mode === "url" ? "bg-paper shadow-sm" : "text-stone")}
            onClick={() => setMode("url")}
          >
            URL externa
          </button>
        </div>
      </div>

      {value.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {value.map((url, index) => (
            <div key={`${url}-${index}`} className="relative overflow-hidden rounded-2xl border border-border bg-ivory">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={`Foto ${index + 1}`} className="aspect-[4/5] w-full object-cover" />
              <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-1 p-2">
                {index === 0 ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-paper/95 px-2 py-1 text-[10px] font-medium uppercase tracking-wide">
                    <Star className="size-3 text-terracotta" /> Capa
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setCover(index)}
                    className="rounded-full bg-paper/95 px-2 py-1 text-[10px] font-medium text-stone hover:text-ink"
                  >
                    Definir capa
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => removeAt(index)}
                  className="rounded-full bg-paper/95 p-1.5 text-stone hover:text-clay"
                  aria-label="Remover imagem"
                >
                  <X className="size-3.5" />
                </button>
              </div>
              <div className="absolute bottom-2 right-2 flex gap-1">
                <button
                  type="button"
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                  className="rounded-full bg-paper/95 p-1.5 text-stone disabled:opacity-40"
                  aria-label="Mover para esquerda"
                >
                  <ArrowUp className="size-3.5 rotate-[-90deg]" />
                </button>
                <button
                  type="button"
                  disabled={index === value.length - 1}
                  onClick={() => move(index, 1)}
                  className="rounded-full bg-paper/95 p-1.5 text-stone disabled:opacity-40"
                  aria-label="Mover para direita"
                >
                  <ArrowDown className="size-3.5 rotate-[-90deg]" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {mode === "upload" ? (
        <div
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            void uploadMany(Array.from(e.dataTransfer.files));
          }}
          onClick={() => inputRef.current?.click()}
          className={cn(
            "flex min-h-[160px] cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-6 text-center transition",
            dragging ? "border-terracotta bg-terracotta/5" : "border-border bg-ivory hover:border-stone/40",
          )}
        >
          {uploading ? (
            <>
              <Loader2 className="size-8 animate-spin text-terracotta" />
              <p className="text-sm text-stone">
                {uploadTotal > 1 ? `Enviando ${uploadTotal} imagens…` : "Enviando imagem…"}
              </p>
            </>
          ) : (
            <>
              <ImagePlus className="size-8 text-stone" />
              <div>
                <p className="text-sm font-medium">Arraste fotos ou clique para adicionar</p>
                <p className="mt-1 text-xs text-stone">JPG, PNG ou WebP · até 5 MB cada · várias imagens</p>
              </div>
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            onChange={(e) => {
              void uploadMany(Array.from(e.target.files ?? []));
              e.target.value = "";
            }}
          />
        </div>
      ) : (
        <div className="flex gap-2">
          <Input
            value={urlDraft}
            onChange={(e) => setUrlDraft(e.target.value)}
            placeholder="https://… ou /products/camiseta.jpg"
          />
          <Button type="button" variant="outline" onClick={applyUrl}>
            <Link2 className="size-4" />
            Adicionar
          </Button>
        </div>
      )}

      {error ? <p className="text-sm text-clay">{error}</p> : null}
      <p className="text-xs text-stone">
        A primeira foto é a capa (catálogo e cards). As demais aparecem no carrossel da página do produto.
      </p>
    </div>
  );
}

/** @deprecated Use ProductImagesField */
export const ProductImageField = ProductImagesField;
