"use client";

import { VesteFit } from "@veste-ai/widget";
import { apiBaseUrl, DEMO_API_KEY } from "@/lib/api";

export function PartnerProductWidget({ productId, sku }: { productId: string; sku?: string }) {
  return (
    <VesteFit
      productId={productId}
      sku={sku}
      apiBaseUrl={apiBaseUrl()}
      apiKey={DEMO_API_KEY}
      accentColor="#c9a46a"
      initialMeasurements={{ height: 180, chest: 102, waist: 88, hip: 100, shoulder: 45 }}
      label="Encontre seu tamanho"
      showBranding={false}
      brandName="Atelier Norte"
    />
  );
}
