"use client";

import dynamic from "next/dynamic";
import type { FitPreview3DProps } from "@veste-ai/fit-preview-3d";
import { RegionGrid } from "./region-grid";

const FitPreview3D = dynamic(() => import("@veste-ai/fit-preview-3d").then((m) => m.FitPreview3D), {
  ssr: false,
  loading: () => (
    <div
      className="flex min-h-[320px] items-center justify-center rounded-3xl border border-border bg-ivory text-sm text-stone"
      role="status"
      aria-live="polite"
    >
      Preparando provador…
    </div>
  ),
});

export interface FitPreview3DLazyProps extends FitPreview3DProps {
  regionsFallback?: FitPreview3DProps["payload"]["regions"];
}

/**
 * Wrapper com `dynamic(..., { ssr: false })`: assets 3D nunca carregam no servidor.
 * Sem WebGL, o `fallback` mantem a analise por regiao (RegionGrid) — a recomendacao
 * textual nunca depende do Canvas.
 */
export function FitPreview3DLazy({ regionsFallback, fallback, ...props }: FitPreview3DLazyProps) {
  return (
    <FitPreview3D
      {...props}
      fallback={
        fallback ?? (
          <div className="space-y-3 rounded-3xl border border-border bg-ivory p-4">
            <p className="text-sm text-stone">Prévia 3D indisponível neste dispositivo. A análise por região continua abaixo.</p>
            {regionsFallback && regionsFallback.length > 0 ? <RegionGrid regions={regionsFallback} compact /> : null}
          </div>
        )
      }
    />
  );
}

export { FitPreview3D };
