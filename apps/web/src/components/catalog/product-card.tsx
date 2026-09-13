"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import type { ProductSummary } from "@veste-ai/contracts";
import { CATEGORY_LABEL, MODELING_LABEL } from "@veste-ai/contracts";
import { formatPrice } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export function ProductCard({ product, index = 0 }: { product: ProductSummary; index?: number }) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.04 * index, ease: [0.2, 0.8, 0.2, 1] }}
      className="group"
    >
      <Link href={`/catalogo/${product.slug}`} className="block">
        <div className="relative overflow-hidden rounded-3xl border border-border bg-paper">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={product.image_url}
            alt={product.name}
            className="aspect-[4/5] w-full object-cover transition duration-700 ease-out group-hover:scale-[1.03]"
            loading="lazy"
          />
          <div className="absolute left-3 top-3 flex gap-2">
            <Badge variant="outline" className="bg-paper/90 backdrop-blur">
              {CATEGORY_LABEL[product.category]}
            </Badge>
          </div>
          <div className="absolute inset-x-3 bottom-3 flex translate-y-2 items-center justify-between rounded-2xl bg-ink/85 px-4 py-3 text-ivory opacity-0 backdrop-blur transition duration-300 group-hover:translate-y-0 group-hover:opacity-100">
            <span className="text-sm font-medium">Analisar caimento</span>
            <ArrowUpRight className="size-4" />
          </div>
        </div>
        <div className="mt-4 flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow">{product.brand}</p>
            <h3 className="mt-1 font-display text-lg font-medium leading-tight">{product.name}</h3>
            <p className="mt-1 text-xs text-stone">
              {MODELING_LABEL[product.modeling]} · {product.composition}
            </p>
          </div>
          <p className="shrink-0 font-medium">{formatPrice(product.price_cents)}</p>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {product.available_sizes.map((s) => (
            <span key={s} className="rounded-md border border-border px-2 py-0.5 text-[11px] text-stone">
              {s}
            </span>
          ))}
        </div>
      </Link>
    </motion.article>
  );
}
