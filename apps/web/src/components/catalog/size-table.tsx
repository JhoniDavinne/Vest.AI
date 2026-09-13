import type { Size } from "@veste-ai/contracts";
import { formatCm } from "@/lib/utils";

const COLUMNS: { key: keyof Size["measurements"]; label: string }[] = [
  { key: "chest", label: "Peito" },
  { key: "waist", label: "Cintura" },
  { key: "hip", label: "Quadril" },
  { key: "shoulder", label: "Ombro" },
  { key: "length", label: "Comprimento" },
  { key: "sleeve", label: "Manga" },
  { key: "width", label: "Largura" },
];

export function SizeTable({ sizes, highlight }: { sizes: Size[]; highlight?: string }) {
  const visible = COLUMNS.filter((c) => sizes.some((s) => s.measurements[c.key] != null));
  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-paper">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-ivory/60 text-left text-[11px] uppercase tracking-[0.14em] text-stone">
            <th className="px-4 py-3 font-medium">Tamanho</th>
            <th className="px-4 py-3 font-medium">SKU</th>
            {visible.map((c) => (
              <th key={c.key} className="px-4 py-3 font-medium">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sizes.map((s) => (
            <tr key={s.sku} className={`border-b border-border/60 last:border-0 ${highlight === s.size_label ? "bg-terracotta/5" : ""}`}>
              <td className="px-4 py-3 font-display text-base">{s.size_label}</td>
              <td className="px-4 py-3 font-mono text-xs text-stone">{s.sku}</td>
              {visible.map((c) => (
                <td key={c.key} className="px-4 py-3 tabular-nums">
                  {formatCm(s.measurements[c.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="px-4 py-2 text-[11px] text-stone">Circunferências completas em cm para peito, cintura e quadril. Largura = medida plana (boca/abertura).</p>
    </div>
  );
}
