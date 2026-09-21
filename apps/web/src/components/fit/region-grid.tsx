"use client";

import { motion } from "framer-motion";
import type { RegionDetail, RegionStatus } from "@veste-ai/contracts";
import { REGION_LABEL, REGION_STATUS_LABEL } from "@veste-ai/contracts";
import { cn, formatCm } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/misc";

export const STATUS_COLOR: Record<RegionStatus, string> = {
  good: "var(--sage)",
  attention: "var(--amber)",
  ease_recommended: "var(--clay)",
  not_evaluated: "var(--slate)",
};

export function StatusDot({ status, className }: { status: RegionStatus; className?: string }) {
  return <span className={cn("inline-block size-2.5 rounded-full", className)} style={{ background: STATUS_COLOR[status] }} />;
}

export function RegionGrid({ regions, compact = false }: { regions: RegionDetail[]; compact?: boolean }) {
  return (
    <div className={cn("grid gap-3", compact ? "grid-cols-2 sm:grid-cols-5" : "grid-cols-2 md:grid-cols-5")}>
      {regions.map((region, index) => (
        <Tooltip key={region.region}>
          <TooltipTrigger asChild>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * index, duration: 0.4 }}
              className={cn(
                "group relative cursor-help overflow-hidden rounded-2xl border-2 bg-paper transition hover:opacity-90",
                compact ? "p-3" : "p-4",
              )}
              style={{ borderColor: STATUS_COLOR[region.status] }}
            >
              <p className="text-[11px] uppercase tracking-[0.14em] text-stone">{REGION_LABEL[region.region]}</p>
              <p className={cn("mt-2 font-medium", compact ? "text-[13px]" : "text-sm")}>
                {REGION_STATUS_LABEL[region.status]}
              </p>
              {!compact && region.ease != null ? (
                <p className="mt-2 text-xs text-stone">
                  Folga {region.ease > 0 ? "+" : ""}
                  {region.ease.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} cm
                  {region.design_ease != null ? ` · prevista ${region.design_ease > 0 ? "+" : ""}${region.design_ease}` : ""}
                </p>
              ) : null}
            </motion.div>
          </TooltipTrigger>
          <TooltipContent>
            <p className="font-medium">{REGION_LABEL[region.region]}</p>
            <p className="mt-1 opacity-80">{region.note}</p>
            {region.body != null && region.garment != null ? (
              <p className="mt-1 opacity-80">
                Corpo {formatCm(region.body)} · Peça {formatCm(region.garment)}
              </p>
            ) : null}
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}
