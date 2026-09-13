"use client";

import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import type { SizeComparison } from "@veste-ai/contracts";
import { cn, formatScore, SCORE_TONE_COLOR, scoreTone } from "@/lib/utils";

export function SizeComparisonBars({
  comparison,
  selectedSize,
  onSelect,
  loadingSize,
}: {
  comparison: SizeComparison[];
  selectedSize: string;
  onSelect?: (size: string) => void;
  loadingSize?: string | null;
}) {
  return (
    <div className="space-y-2.5">
      {comparison.map((item, index) => {
        const active = item.size === selectedSize;
        const color = SCORE_TONE_COLOR[scoreTone(item.fit_score)];
        return (
          <motion.button
            key={item.sku}
            type="button"
            onClick={() => onSelect?.(item.size)}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.05 * index }}
            className={cn(
              "group flex w-full items-center gap-4 rounded-2xl border px-4 py-3 text-left transition-all",
              active ? "border-ink bg-paper shadow-soft" : "border-border bg-paper/60 hover:border-ink/30 hover:bg-paper",
              loadingSize === item.size && "opacity-60",
            )}
            aria-pressed={active}
          >
            <span
              className={cn(
                "flex size-11 shrink-0 items-center justify-center rounded-xl font-display text-lg font-medium",
                item.recommended ? "bg-ink text-ivory" : "bg-secondary text-ink",
              )}
            >
              {item.size}
            </span>
            <div className="flex-1">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 font-medium">
                  Tamanho {item.size}
                  {item.recommended ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-terracotta/10 px-2 py-0.5 text-[11px] font-medium text-terracotta-dark">
                      <Sparkles className="size-3" /> Recomendado
                    </span>
                  ) : null}
                </span>
                <span className="font-display text-lg">{formatScore(item.fit_score)}</span>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-mist">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: color }}
                  initial={{ width: 0 }}
                  animate={{ width: `${item.fit_score * 10}%` }}
                  transition={{ duration: 0.9, ease: [0.2, 0.8, 0.2, 1], delay: 0.1 + 0.05 * index }}
                />
              </div>
            </div>
          </motion.button>
        );
      })}
    </div>
  );
}
