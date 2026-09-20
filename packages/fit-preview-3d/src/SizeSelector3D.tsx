"use client";

import * as React from "react";
import type { SizeOption } from "./fitVisualization";
import { ensureFitPreviewStyles } from "./styles";

export interface SizeSelector3DProps {
  options: SizeOption[];
  selectedSize: string;
  recommendedSize: string | null;
  /** Tamanho cujo estado ainda esta sendo obtido da API (quando comparison nao traz regions). */
  loadingSize?: string | null;
  onSelect: (size: string) => void;
  compact?: boolean;
  disabled?: boolean;
  /** Mostra a dica "• recomendado" abaixo dos chips. Padrao: true. */
  showHint?: boolean;
}

function formatScore(value: number): string {
  return value.toFixed(1).replace(".", ",");
}

/**
 * Seletor de tamanho do provador (HTML, fora do Canvas).
 *
 * - `role="radiogroup"` com navegacao por setas (roving tabindex), Home/End;
 * - recomendado marcado por ponto terracota + `aria-label` (nao depende so de cor);
 * - selecionado em `aria-checked`; loading por tamanho via `data-loading`.
 * Nao calcula nada: scores vem do motor (`SizeOption.fitScore`).
 */
export function SizeSelector3D({
  options,
  selectedSize,
  recommendedSize,
  loadingSize = null,
  onSelect,
  compact = false,
  disabled = false,
  showHint = true,
}: SizeSelector3DProps) {
  React.useEffect(() => {
    ensureFitPreviewStyles();
  }, []);
  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);

  if (options.length === 0) return null;

  const selectedIndex = Math.max(0, options.findIndex((o) => o.size === selectedSize));

  const focusAndSelect = (index: number) => {
    const total = options.length;
    const next = ((index % total) + total) % total;
    const option = options[next];
    refs.current[next]?.focus();
    if (option && option.size !== selectedSize) onSelect(option.size);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        event.preventDefault();
        focusAndSelect(index + 1);
        break;
      case "ArrowLeft":
      case "ArrowUp":
        event.preventDefault();
        focusAndSelect(index - 1);
        break;
      case "Home":
        event.preventDefault();
        focusAndSelect(0);
        break;
      case "End":
        event.preventDefault();
        focusAndSelect(options.length - 1);
        break;
      default:
        break;
    }
  };

  const hasRecommended = options.some((o) => o.recommended || o.size === recommendedSize);

  return (
    <div className={compact ? "vfp-root vfp-compact" : "vfp-root"}>
      <div
        role="radiogroup"
        aria-label="Tamanho exibido no provador"
        data-testid="size-selector-3d"
        className="vfp-sizes"
      >
        {options.map((option, index) => {
          const active = option.size === selectedSize;
          const recommended = option.recommended || option.size === recommendedSize;
          const loading = loadingSize === option.size;
          const label = `Tamanho ${option.size}, caimento ${formatScore(option.fitScore)} de 10${recommended ? ", recomendado" : ""}${
            loading ? ", atualizando" : ""
          }`;
          return (
            <button
              key={option.sku || option.size}
              ref={(el) => {
                refs.current[index] = el;
              }}
              type="button"
              role="radio"
              className="vfp-size"
              aria-checked={active}
              aria-label={label}
              title={recommended ? `Recomendado pelo motor · ${formatScore(option.fitScore)}/10` : `${formatScore(option.fitScore)}/10`}
              tabIndex={index === selectedIndex ? 0 : -1}
              disabled={disabled}
              aria-busy={loading || undefined}
              data-recommended={recommended || undefined}
              data-loading={loading || undefined}
              onKeyDown={(event) => onKeyDown(event, index)}
              onClick={() => {
                if (!active) onSelect(option.size);
              }}
            >
              {recommended ? <span className="vfp-size-mark" aria-hidden="true" /> : null}
              <span className="vfp-size-label">{option.size}</span>
              <span className="vfp-size-score" aria-hidden="true">
                {loading ? "…" : formatScore(option.fitScore)}
              </span>
            </button>
          );
        })}
      </div>
      {showHint && hasRecommended ? (
        <p className="vfp-sizes-hint" aria-hidden="true">
          <i /> recomendado pelo motor · valor = caimento /10
        </p>
      ) : null}
    </div>
  );
}
