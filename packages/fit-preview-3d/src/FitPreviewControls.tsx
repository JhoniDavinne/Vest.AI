"use client";

import * as React from "react";
import type { CameraView } from "./cameraViews";

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

const buttonStyle = (active: boolean, compact: boolean): React.CSSProperties => ({
  border: `1px solid ${active ? "#141416" : "#ddd6cb"}`,
  background: active ? "#141416" : "#ffffff",
  color: active ? "#f7f4ef" : "#2a2a2e",
  borderRadius: 999,
  padding: compact ? "4px 9px" : "6px 12px",
  fontSize: compact ? 11 : 12,
  lineHeight: 1.2,
  cursor: "pointer",
  fontFamily: "inherit",
});

/** Controles HTML fora do Canvas: vistas predefinidas, zoom e reset. */
export function FitPreviewControls({ compact = false, activeView, onView, onZoom, onReset }: FitPreviewControlsProps) {
  return (
    <div
      role="toolbar"
      aria-label="Controles do provador 3D"
      data-testid="fit-preview-controls"
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 6,
        alignItems: "center",
        justifyContent: "space-between",
        padding: compact ? "8px 8px 0" : "10px 10px 0",
      }}
    >
      <div style={{ display: "flex", gap: 6 }}>
        {(Object.keys(VIEW_LABEL) as CameraView[]).map((view) => (
          <button
            key={view}
            type="button"
            aria-pressed={activeView === view}
            aria-label={`Vista ${VIEW_LABEL[view].toLowerCase()}`}
            style={buttonStyle(activeView === view, compact)}
            onClick={() => onView(view)}
          >
            {VIEW_LABEL[view]}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <button type="button" aria-label="Aproximar" style={buttonStyle(false, compact)} onClick={() => onZoom(1)}>
          +
        </button>
        <button type="button" aria-label="Afastar" style={buttonStyle(false, compact)} onClick={() => onZoom(-1)}>
          −
        </button>
        <button type="button" aria-label="Redefinir camera" style={buttonStyle(false, compact)} onClick={onReset}>
          Reset
        </button>
      </div>
    </div>
  );
}
