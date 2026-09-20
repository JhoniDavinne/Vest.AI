"use client";

import * as React from "react";
import type { FitPreview3DProps } from "./types";
import { FIT_PREVIEW_DISCLAIMER } from "./constants";
import { AvatarScene } from "./AvatarScene";
import { useFitPreviewCanvasHeight, useWebGLAvailable } from "./useFitPreview";

export function FitPreview3D({
  payload,
  size = "full",
  modelsBaseUrl,
  className,
  fallback,
  showDisclaimer = true,
}: FitPreview3DProps) {
  const webgl = useWebGLAvailable();
  const height = useFitPreviewCanvasHeight(size);
  const [contextLost, setContextLost] = React.useState(false);

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

  return (
    <div className={className} data-testid="fit-preview-3d">
      <div
        style={{
          overflow: "hidden",
          borderRadius: size === "compact" ? 16 : 24,
          border: "1px solid #ddd6cb",
        }}
      >
        <AvatarScene
          payload={payload}
          modelsBaseUrl={modelsBaseUrl}
          height={height}
          onContextLost={handleContextLost}
        />
      </div>
      {showDisclaimer ? (
        <p
          style={{
            marginTop: 8,
            fontSize: size === "compact" ? 10 : 11,
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
        Arraste para rotacionar
      </p>
    </div>
  );
}
