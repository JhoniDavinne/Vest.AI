"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

export function JsonViewer({ data, className, maxHeight = 480 }: { data: unknown; className?: string; maxHeight?: number }) {
  const [copied, setCopied] = React.useState(false);
  const text = React.useMemo(() => JSON.stringify(data, null, 2), [data]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard indisponivel */
    }
  }

  return (
    <div className={cn("relative overflow-hidden rounded-2xl border border-white/10 bg-ink text-ivory", className)}>
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2 text-[11px] uppercase tracking-[0.14em] text-ivory/60">
        <span>JSON</span>
        <button type="button" onClick={copy} className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 hover:bg-white/10">
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copied ? "Copiado" : "Copiar"}
        </button>
      </div>
      <pre className="overflow-auto p-4 font-mono text-[12px] leading-relaxed" style={{ maxHeight }}>
        <Highlighted text={text} />
      </pre>
    </div>
  );
}

function Highlighted({ text }: { text: string }) {
  const parts = text.split(/("(?:\\.|[^"\\])*"(?=\s*:))|("(?:\\.|[^"\\])*")|(\b-?\d+(?:\.\d+)?\b)|(\btrue\b|\bfalse\b|\bnull\b)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (!part) return null;
        if (/^"(?:\\.|[^"\\])*"$/.test(part) && text.indexOf(part + ":") !== -1 && i % 5 === 1) {
          return <span key={i} className="text-[#E7C9B4]">{part}</span>;
        }
        if (/^"/.test(part)) return <span key={i} className="text-[#B7D1B0]">{part}</span>;
        if (/^-?\d/.test(part)) return <span key={i} className="text-[#F0C987]">{part}</span>;
        if (/^(true|false|null)$/.test(part)) return <span key={i} className="text-[#9FB7D6]">{part}</span>;
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}
