"use client";

import { motion } from "framer-motion";
import type { ComponentScores } from "@veste-ai/contracts";
import { ENGINE_COMPONENTS } from "@/lib/engine-components";
import { cn } from "@/lib/utils";

export function WeightsBar({ className, weights }: { className?: string; weights?: Record<string, number> }) {
  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex h-3 w-full overflow-hidden rounded-full">
        {ENGINE_COMPONENTS.map((c, i) => {
          const w = weights?.[c.key] ?? c.weight;
          if (!w) return null;
          return (
            <motion.div
              key={c.key}
              className="h-full"
              style={{ background: c.color }}
              initial={{ width: 0 }}
              animate={{ width: `${w * 100}%` }}
              transition={{ duration: 0.8, delay: 0.08 * i, ease: [0.2, 0.8, 0.2, 1] }}
            />
          );
        })}
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-stone">
        {ENGINE_COMPONENTS.map((c) => {
          const w = weights?.[c.key] ?? c.weight;
          return (
            <span key={c.key} className="inline-flex items-center gap-1.5">
              <span className="size-2 rounded-full" style={{ background: c.color }} />
              <span className="font-medium text-ink">{Math.round(w * 100)}%</span> {c.label}
              {w === 0 ? <span className="opacity-70">(sem foto)</span> : null}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export function ComponentBreakdown({
  components,
  weights,
}: {
  components: ComponentScores;
  weights: Record<string, number>;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {ENGINE_COMPONENTS.map((c, i) => {
        const value = components[c.key];
        const weight = weights[c.key] ?? c.weight;
        const Icon = c.icon;
        const unavailable = value == null || weight === 0;
        return (
          <motion.div
            key={c.key}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 * i }}
            className={cn("rounded-2xl border border-border bg-paper p-4", unavailable && "opacity-70")}
          >
            <div className="flex items-center justify-between">
              <span className="flex size-8 items-center justify-center rounded-lg" style={{ background: `${c.color}1A`, color: c.color }}>
                <Icon className="size-4" />
              </span>
              <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-stone">{Math.round(weight * 100)}%</span>
            </div>
            <p className="mt-3 text-sm font-medium">{c.label}</p>
            <p className="mt-1 font-display text-2xl">{unavailable ? "—" : (value * 10).toFixed(1).replace(".", ",")}</p>
            <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-mist">
              <motion.div
                className="h-full rounded-full"
                style={{ background: c.color }}
                initial={{ width: 0 }}
                animate={{ width: `${(value ?? 0) * 100}%` }}
                transition={{ duration: 0.8, delay: 0.1 + 0.05 * i }}
              />
            </div>
            <p className="mt-2 text-[11.5px] leading-snug text-stone">
              {unavailable && c.key === "visual_proportion" ? "Sem foto — peso redistribuído." : `Contribui ${((value ?? 0) * weight * 10).toFixed(2).replace(".", ",")} pts`}
            </p>
          </motion.div>
        );
      })}
    </div>
  );
}
