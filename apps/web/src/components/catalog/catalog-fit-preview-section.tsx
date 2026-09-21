"use client";

import * as React from "react";
import type { Product } from "@veste-ai/contracts";
import { api, ApiError } from "@/lib/api";
import { useProfile } from "@/lib/profile";
import { Skeleton } from "@/components/ui/misc";
import { FIT_PREVIEW_3D_ENABLED } from "@/lib/feature-flags";
import { ProductFitPreview } from "./product-fit-preview";

const DEMO_MEASUREMENTS = { height: 180, weight: 78, chest: 102, waist: 88, hip: 100, shoulder: 45 };

export function CatalogFitPreviewSection({ product }: { product: Product }) {
  if (!FIT_PREVIEW_3D_ENABLED) return null;
  const { user, loading: profileLoading } = useProfile();
  const [recommendation, setRecommendation] = React.useState<Awaited<ReturnType<typeof api.recommend>> | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const defaultSize = product.sizes.find((s) => s.size_label === "M") ?? product.sizes[Math.floor(product.sizes.length / 2)];

  React.useEffect(() => {
    if (profileLoading || !defaultSize) return;
    let cancelled = false;
    setError(null);
    api
      .recommend({
        sku: defaultSize.sku,
        user_id: user?.id,
        customer: user ? undefined : DEMO_MEASUREMENTS,
        channel: "web",
        persist: false,
        use_photo: Boolean(user?.photo_analysis?.status === "completed"),
      })
      .then((result) => {
        if (!cancelled) setRecommendation(result);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Não foi possível gerar a prévia.");
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.photo_analysis?.status, profileLoading, defaultSize?.sku]);

  if (profileLoading || (!recommendation && !error)) {
    return (
      <div className="rounded-3xl border border-border bg-paper p-6 shadow-soft">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="mt-4 h-[360px] rounded-2xl" />
      </div>
    );
  }

  if (error || !recommendation) {
    return (
      <div className="rounded-3xl border border-border bg-ivory p-6 text-sm text-stone">
        Prévia 3D indisponível no momento. {error}
      </div>
    );
  }

  return <ProductFitPreview product={product} recommendation={recommendation} />;
}
