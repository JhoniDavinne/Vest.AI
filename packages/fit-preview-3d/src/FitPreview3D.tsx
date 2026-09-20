"use client";

import * as React from "react";
import type { FitPreview3DProps } from "./types";
import { DEFAULT_MODELS_BASE, FIT_PREVIEW_DISCLAIMER } from "./constants";
import { AvatarScene } from "./AvatarScene";
import { FitPreviewControls } from "./FitPreviewControls";
import type { CameraCommand } from "./CameraRig";
import type { CameraView } from "./cameraViews";
import { useFitPreviewCanvasHeight, useWebGLAvailable } from "./useFitPreview";
import { useModelsManifest } from "./useModelsManifest";

/**
 * Provador visual 3D. Cadeia de fallback:
 *   WebGL indisponivel / contexto perdido -> `fallback` (host mostra RegionGrid)
 *   manifest indisponivel ou asset placeholder -> silhueta + primitivas (v1)
 *   GLB falha ao carregar -> mesma silhueta/primitivas (ModelErrorBoundary)
 * Nenhum caminho afeta a recomendacao: o componente so consome `payload`.
 */
export function FitPreview3D({
  payload,
  size = "full",
  modelsBaseUrl = DEFAULT_MODELS_BASE,
  className,
  fallback,
  showDisclaimer = true,
  showControls = true,
  renderPlaceholders = false,
  onAssetError,
}: FitPreview3DProps) {
  const webgl = useWebGLAvailable();
  const height = useFitPreviewCanvasHeight(size);
  const [contextLost, setContextLost] = React.useState(false);
  const { manifest, status: manifestStatus } = useModelsManifest(modelsBaseUrl, webgl && !contextLost);

  const [cameraCommand, setCameraCommand] = React.useState<CameraCommand | null>(null);
  const [activeView, setActiveView] = React.useState<CameraView | null>("front");
  const commandId = React.useRef(0);

  const dispatch = React.useCallback((command: Omit<CameraCommand, "id">) => {
    commandId.current += 1;
    setCameraCommand({ id: commandId.current, ...command });
  }, []);

  const handleContextLost = React.useCallback(() => {
    setContextLost(true);
  }, []);

  const fallbackNode =
    fallback ?? (
      <div
        style={{
          minHeight: height,
          display: "grid",
          placeItems: "center",
          padding: 16,
          borderRadius: 24,
          border: "1px solid #ddd6cb",
          background: "#f7f4ef",
          color: "#6b6560",
          fontSize: 14,
          textAlign: "center",
        }}
      >
        Prévia 3D indisponível neste dispositivo. Use a análise por região abaixo.
      </div>
    );

  if (!webgl || contextLost) {
    return (
      <div className={className} data-testid="fit-preview-fallback">
        {fallbackNode}
      </div>
    );
  }

  const compact = size === "compact";

  return (
    <div className={className} data-testid="fit-preview-3d" data-manifest-status={manifestStatus}>
      <div
        style={{
          overflow: "hidden",
          borderRadius: compact ? 16 : 24,
          border: "1px solid #ddd6cb",
          background: "#f7f4ef",
        }}
      >
        {showControls ? (
          <FitPreviewControls
            compact={compact}
            activeView={activeView}
            onView={(view) => {
              setActiveView(view);
              dispatch({ type: "view", view });
            }}
            onZoom={(direction) => {
              setActiveView(null);
              dispatch({ type: "zoom", direction });
            }}
            onReset={() => {
              setActiveView("front");
              dispatch({ type: "reset" });
            }}
          />
        ) : null}
        <AvatarScene
          payload={payload}
          modelsBaseUrl={modelsBaseUrl}
          manifest={manifest}
          renderPlaceholders={renderPlaceholders}
          height={height}
          cameraCommand={cameraCommand}
          onContextLost={handleContextLost}
          onAssetError={onAssetError}
        />
      </div>
      {showDisclaimer ? (
        <p
          style={{
            marginTop: 8,
            fontSize: compact ? 10 : 11,
            lineHeight: 1.45,
            color: "#8a837a",
          }}
        >
          {payload.disclaimer || FIT_PREVIEW_DISCLAIMER}
        </p>
      ) : null}
      <p
        style={{
          marginTop: 4,
          fontSize: 10,
          color: "#a39a90",
          textAlign: "center",
        }}
        aria-hidden="true"
      >
        Arraste para rotacionar · scroll para zoom
      </p>
    </div>
  );
}
