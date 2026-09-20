"use client";

import * as React from "react";
import type { SizeOption } from "./fitVisualization";

export interface SizeSelector3DProps {
  options: SizeOption[];
  selectedSize: string;
  recommendedSize: string | null;
  /** Tamanho cujo estado ainda esta sendo obtido da API (quando comparison nao traz regions). */
  loadingSize?: string | null;
  onSelect: (size: string) => void;
  compact?: boolean;
  disabled?: boolean;
}

function formatScore(value: number): string {
  return value.toFixed(1).replace(".", ",");
}

const chipStyle = (active: boolean, recommended: boolean, compact: boolean, loading: boolean): React.CSSProperties => ({
  display: "inline-flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 2,
  minWidth: compact ? 44 : 56,
  padding: compact ? "5px 8px" : "7px 12px",
  borderRadius: 12,
  border: `1px solid ${active ? "#141416" : recommended ? "#c4623a" : "#ddd6cb"}`,
  background: active ? "#141416" : "#ffffff",
  color: active ? "#f7f4ef" : "#141416",
  cursor: loading ? "progress" : "pointer",
  opacity: loading ? 0.6 : 1,
  fontFamily: "inherit",
  lineHeight: 1.1,
  transition: "all .15s",
});

/**
 * Seletor de tamanho do provador (HTML, fora do Canvas).
 * Lista os tamanhos devolvidos pelo motor com o fit_score de cada um,
 * destaca o recomendado e o selecionado. Nao calcula nada.
 */
export function SizeSelector3D({
  options,
  selectedSize,
  recommendedSize,
  loadingSize = null,
  onSelect,
  compact = false,
  disabled = false,
}: SizeSelector3DProps) {
  if (options.length === 0) return null;
  return (
    <div
      role="radiogroup"
      aria-label="Tamanho exibido no provador"
      data-testid="size-selector-3d"
      style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}
    >
      {options.map((option) => {
        const active = option.size === selectedSize;
        const recommended = option.recommended || option.size === recommendedSize;
        const loading = loadingSize === option.size;
        return (
          <button
            key={option.sku || option.size}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={`Tamanho ${option.size}, score ${formatScore(option.fitScore)}${recommended ? ", recomendado" : ""}`}
            disabled={disabled}
            data-recommended={recommended || undefined}
            style={chipStyle(active, recommended, compact, loading)}
            onClick={() => {
              if (!active) onSelect(option.size);
            }}
          >
            <span style={{ fontSize: compact ? 13 : 15, fontWeight: 600 }}>{option.size}</span>
            <span style={{ fontSize: compact ? 10 : 11, opacity: active ? 0.8 : 0.65 }}>
              {loading ? "…" : formatScore(option.fitScore)}
            </span>
            {recommended ? (
              <span
                style={{
                  fontSize: 9,
                  letterSpacing: ".08em",
                  textTransform: "uppercase",
                  color: active ? "#f0b79a" : "#a24e2c",
                }}
              >
                Recomendado
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
