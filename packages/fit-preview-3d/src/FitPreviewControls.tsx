"use client";

import * as React from "react";
import type { CameraView } from "./cameraViews";
import { ensureFitPreviewStyles } from "./styles";

interface FitPreviewControlsProps {
  compact?: boolean;
  activeView: CameraView | null;
  onView: (view: CameraView) => void;
  onZoom: (direction: 1 | -1) => void;
  onReset: () => void;
}

const VIEW_LABEL: Record<CameraView, string> = {
  front: "Frente",
  side: "Lateral",
  back: "Costas",
};

/* Icones inline (sem dependencia nova); tracos alinhados ao Lucide usado no web. */
function IconPlus() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
function IconMinus() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M5 12h14" />
    </svg>
  );
}
function IconReset() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  );
}

/** Controles HTML fora do Canvas: vistas predefinidas, zoom e reset. */
export function FitPreviewControls({ compact = false, activeView, onView, onZoom, onReset }: FitPreviewControlsProps) {
  React.useEffect(() => {
    ensureFitPreviewStyles();
  }, []);

  return (
    <div
      role="toolbar"
      aria-label="Controles do provador 3D"
      data-testid="fit-preview-controls"
      className={compact ? "vfp-bar vfp-compact" : "vfp-bar"}
    >
      <div className="vfp-seg" role="group" aria-label="Vista">
        {(Object.keys(VIEW_LABEL) as CameraView[]).map((view) => (
          <button
            key={view}
            type="button"
            className="vfp-btn"
            aria-pressed={activeView === view}
            aria-label={`Vista ${VIEW_LABEL[view].toLowerCase()}`}
            title={`Ver de ${VIEW_LABEL[view].toLowerCase()}`}
            onClick={() => onView(view)}
          >
            {VIEW_LABEL[view]}
          </button>
        ))}
      </div>
      <div className="vfp-seg" role="group" aria-label="Zoom e câmera">
        <button type="button" className="vfp-btn vfp-icon" aria-label="Aproximar" title="Aproximar (zoom +)" onClick={() => onZoom(1)}>
          <IconPlus />
        </button>
        <button type="button" className="vfp-btn vfp-icon" aria-label="Afastar" title="Afastar (zoom −)" onClick={() => onZoom(-1)}>
          <IconMinus />
        </button>
        <button type="button" className="vfp-btn" aria-label="Redefinir câmera" title="Voltar à vista inicial" onClick={onReset}>
          <IconReset />
          {compact ? null : <span>Reset</span>}
        </button>
      </div>
    </div>
  );
}
