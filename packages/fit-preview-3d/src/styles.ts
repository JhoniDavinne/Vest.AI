/**
 * CSS do provador (prefixo `vfp-`), injetado uma unica vez no <head>.
 *
 * Inline styles nao cobrem :hover, :focus-visible nem prefers-reduced-motion;
 * por isso os controles HTML do pacote usam estas classes. Tokens alinhados ao
 * design system do VESTE.AI (--ink, --ivory, --mist, --terracotta, --sage...).
 */
export const FIT_PREVIEW_CSS = `
.vfp-root{--vfp-ink:#141416;--vfp-ink-2:#2a2a2e;--vfp-stone:#6f6b66;--vfp-mist:#e9e5df;--vfp-ivory:#f7f4ef;--vfp-paper:#fff;--vfp-accent:#c4623a;--vfp-accent-dark:#a24e2c;--vfp-sage:#5f7f6a;font-family:inherit;color:var(--vfp-ink);min-width:0}
.vfp-root *{box-sizing:border-box}
.vfp-frame{overflow:hidden;border-radius:24px;border:1px solid var(--vfp-mist);background:var(--vfp-ivory);position:relative}
.vfp-frame.vfp-compact{border-radius:16px}
.vfp-stage{position:relative}
.vfp-stage canvas{touch-action:pan-y;display:block}
.vfp-fade{animation:vfp-fade .28s ease}
.vfp-updating{position:absolute;left:50%;top:12px;transform:translateX(-50%);background:rgba(255,255,255,.88);border:1px solid var(--vfp-mist);border-radius:999px;padding:5px 12px;font-size:12px;color:var(--vfp-ink-2);display:inline-flex;align-items:center;gap:8px;pointer-events:none;backdrop-filter:blur(4px);z-index:2}
.vfp-spinner{width:12px;height:12px;border-radius:50%;border:2px solid var(--vfp-mist);border-top-color:var(--vfp-ink);animation:vfp-spin .8s linear infinite}
.vfp-bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:space-between;padding:10px}
.vfp-bar.vfp-compact{padding:8px;gap:6px}
.vfp-seg{display:inline-flex;gap:2px;background:var(--vfp-paper);border:1px solid var(--vfp-mist);border-radius:999px;padding:3px}
.vfp-btn{appearance:none;border:0;background:transparent;color:var(--vfp-ink-2);border-radius:999px;padding:6px 12px;font:inherit;font-size:12px;font-weight:500;line-height:1.2;cursor:pointer;display:inline-flex;align-items:center;gap:6px;min-height:32px;transition:background .15s,color .15s,box-shadow .15s}
.vfp-btn:hover{background:var(--vfp-ivory)}
.vfp-btn[aria-pressed="true"]{background:var(--vfp-ink);color:var(--vfp-ivory)}
.vfp-btn:focus-visible{outline:none;box-shadow:0 0 0 2px var(--vfp-paper),0 0 0 4px rgba(20,20,22,.45)}
.vfp-btn:disabled{opacity:.5;cursor:not-allowed}
.vfp-btn.vfp-icon{width:32px;padding:0;justify-content:center}
.vfp-btn svg{width:14px;height:14px;flex:none}
.vfp-compact .vfp-btn{font-size:11px;padding:5px 10px;min-height:28px}
.vfp-compact .vfp-btn.vfp-icon{width:28px}
.vfp-sizes{display:flex;flex-wrap:wrap;gap:6px;align-items:stretch}
.vfp-size{appearance:none;font:inherit;border:1px solid var(--vfp-mist);background:var(--vfp-paper);color:var(--vfp-ink);border-radius:12px;min-width:56px;padding:7px 10px 6px;display:inline-flex;flex-direction:column;align-items:center;gap:2px;line-height:1.1;cursor:pointer;position:relative;transition:border-color .15s,background .15s,color .15s,transform .15s}
.vfp-size:hover{border-color:rgba(20,20,22,.4)}
.vfp-size:focus-visible{outline:none;box-shadow:0 0 0 2px var(--vfp-paper),0 0 0 4px rgba(20,20,22,.45)}
.vfp-size[aria-checked="true"]{background:var(--vfp-ink);color:var(--vfp-ivory);border-color:var(--vfp-ink)}
.vfp-size[data-recommended="true"]{border-color:var(--vfp-accent)}
.vfp-size[data-recommended="true"][aria-checked="true"]{border-color:var(--vfp-ink)}
.vfp-size:disabled{opacity:.45;cursor:not-allowed}
.vfp-size[data-loading="true"]{cursor:progress}
.vfp-size-label{font-size:15px;font-weight:600}
.vfp-size-score{font-size:11px;opacity:.7;font-variant-numeric:tabular-nums}
.vfp-size-mark{position:absolute;top:-5px;right:-5px;width:12px;height:12px;border-radius:50%;background:var(--vfp-accent);border:2px solid var(--vfp-paper)}
.vfp-size[aria-checked="true"] .vfp-size-mark{border-color:var(--vfp-ink)}
.vfp-compact .vfp-size{min-width:46px;padding:5px 8px}
.vfp-compact .vfp-size-label{font-size:13px}
.vfp-compact .vfp-size-score{font-size:10px}
.vfp-sizes-hint{font-size:11px;color:var(--vfp-stone);display:inline-flex;align-items:center;gap:6px;margin-top:6px}
.vfp-sizes-hint i{width:8px;height:8px;border-radius:50%;background:var(--vfp-accent);display:inline-block}
.vfp-legend{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:6px 14px;font-size:12px;color:var(--vfp-ink-2)}
.vfp-legend.vfp-list{flex-direction:column;gap:0}
.vfp-legend.vfp-list li{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:9px 0;border-bottom:1px solid var(--vfp-mist);font-size:13px}
.vfp-legend.vfp-list li:last-child{border-bottom:0}
.vfp-legend li{display:inline-flex;align-items:center;gap:8px}
.vfp-legend-dot{width:9px;height:9px;border-radius:50%;flex:none}
.vfp-legend-status{display:inline-flex;align-items:center;gap:6px;font-weight:500}
.vfp-legend-glyph{font-size:11px;opacity:.8;font-weight:600}
.vfp-summary{display:flex;flex-wrap:wrap;align-items:baseline;gap:8px;font-size:13px;color:var(--vfp-ink-2)}
.vfp-summary strong{font-weight:600}
.vfp-muted{color:var(--vfp-stone)}
.vfp-disclaimer{margin-top:8px;font-size:11px;line-height:1.45;color:#8a837a}
.vfp-hint{margin-top:4px;font-size:10px;color:#a39a90;text-align:center}
.vfp-fallback{min-height:200px;display:grid;place-items:center;padding:16px;border-radius:24px;border:1px solid var(--vfp-mist);background:var(--vfp-ivory);color:#6b6560;font-size:14px;text-align:center}
@keyframes vfp-fade{from{opacity:0}to{opacity:1}}
@keyframes vfp-spin{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion:reduce){.vfp-fade{animation:none}.vfp-btn,.vfp-size{transition:none}}
`;

let injected = false;

export function ensureFitPreviewStyles(doc: Document | undefined = typeof document === "undefined" ? undefined : document): void {
  if (!doc || injected) return;
  if (doc.getElementById("veste-fit-preview-css")) {
    injected = true;
    return;
  }
  const style = doc.createElement("style");
  style.id = "veste-fit-preview-css";
  style.textContent = FIT_PREVIEW_CSS;
  doc.head.appendChild(style);
  injected = true;
}
