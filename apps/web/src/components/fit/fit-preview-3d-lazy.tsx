"use client";

import dynamic from "next/dynamic";
import type { FitPreview3DProps } from "@veste-ai/fit-preview-3d";
import { RegionGrid } from "./region-grid";

const FitPreview3D = dynamic(() => import("@veste-ai/fit-preview-3d").then((m) => m.FitPreview3D), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[320px] items-center justify-center rounded-3xl border border-border bg-ivory text-sm text-stone">
      Carregando provador 3D…
    </div>
  ),
});

export interface FitPreview3DLazyProps extends FitPreview3DProps {
  regionsFallback?: FitPreview3DProps["payload"]["regions"];
}

export function FitPreview3DLazy({ regionsFallback, fallback, ...props }: FitPreview3DLazyProps) {
  return (
    <FitPreview3D
      {...props}
      fallback={
        fallback ?? (
          <div className="space-y-3 rounded-3xl border border-border bg-ivory p-4">
            <p className="text-sm text-stone">Prévia 3D indisponível neste dispositivo.</p>
            {regionsFallback ? <RegionGrid regions={regionsFallback} compact /> : null}
          </div>
        )
      }
    />
  );
}

export { FitPreview3D };
