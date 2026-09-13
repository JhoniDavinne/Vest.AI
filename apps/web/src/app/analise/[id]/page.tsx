import type { Metadata } from "next";
import { SiteShell } from "@/components/site/shell";
import { ResultView } from "@/components/fit/result-view";

export const metadata: Metadata = { title: "Resultado da análise" };

export default async function AnalysisPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <SiteShell>
      <ResultView analysisId={id} />
    </SiteShell>
  );
}
