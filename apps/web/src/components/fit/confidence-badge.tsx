import { ShieldCheck, ShieldAlert, ShieldQuestion } from "lucide-react";
import type { Confidence } from "@veste-ai/contracts";
import { CONFIDENCE_LABEL } from "@veste-ai/contracts";
import { Badge } from "@/components/ui/badge";

const VARIANT: Record<Confidence, "sage" | "amber" | "clay"> = { high: "sage", medium: "amber", low: "clay" };
const ICON: Record<Confidence, typeof ShieldCheck> = { high: ShieldCheck, medium: ShieldAlert, low: ShieldQuestion };

export function ConfidenceBadge({ confidence, className }: { confidence: Confidence; className?: string }) {
  const Icon = ICON[confidence];
  return (
    <Badge variant={VARIANT[confidence]} className={className}>
      <Icon className="size-3.5" />
      Confiança {CONFIDENCE_LABEL[confidence].toLowerCase()}
    </Badge>
  );
}
