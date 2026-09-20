"use client";

import * as React from "react";
import type { FitPreview3DProps } from "./types";
import { DEFAULT_MODELS_BASE, FIT_PREVIEW_DISCLAIMER } from "./constants";
import { AvatarScene } from "./AvatarScene";
import { FitPreviewControls } from "./FitPreviewControls";
import { FitLegend } from "./FitLegend";
import { SizeSelector3D } from "./SizeSelector3D";
import type { CameraCommand } from "./CameraRig";
import type { CameraView } from "./cameraViews";
import { applyFitStateToPayload, createFitVisualizationStateFromPayload } from "./fitVisualization";
import { useFitPreviewCanvasHeight, useWebGLAvailable } from "./useFitPreview";
import { useModelsManifest } from "./useModelsManifest";

function formatScore(value: number): string {
  return value.toFixed(1).replace(".", ",");
}

/**
 * Provador visual 3D.
 *
 *   RecommendationResponse → createFitVisualizationState*() → `fit`
 *   FitPreview3D
 *     ├── SizeSelector3D   (HTML)   tamanhos do motor, recomendado × selecionado
 *     ├── FitPreviewControls (HTML) camera
 *     ├── AvatarScene (Canvas)      avatar · peca · RegionalOverlay(fit.regionList)
 *     └── FitLegend (HTML)          "Peito — Compatível"
 *
 * Cadeia de fallback:
 *   WebGL indisponivel / contexto perdido → `fallback` (host mostra RegionGrid)
 *   manifest indisponivel ou asset placeholder → silhueta + primitivas
 *   GLB falha → mesma silhueta/primitivas (ModelErrorBoundary)
 * Nenhum caminho afeta a recomendacao: o componente so consome dados do motor.
 */
export function FitPreview3D({
  payload,
  fit = null,
  sizes,
  onSelectSize,
  loadingSize = null,
  size = "full",
  modelsBaseUrl = DEFAULT_MODELS_BASE,
  className,
  fallback,
  showDisclaimer = true,
  showControls = true,
  showLegend = true,
  showSummary,
  renderPlaceholders = false,
  onAssetError,
}: FitPreview3DProps) {
  const webgl = useWebGLAvailable();
  const height = useFitPreviewCanvasHeight(size);
  const [contextLost, setContextLost] = React.useState(false);
  const { manifest, status: manifestStatus } = useModelsManifest(modelsBaseUrl, webgl && !contextLost);

  const effectiveFit = React.useMemo(() => fit ?? createFitVisualizationStateFromPayload(payload), [fit, payload]);
  const effectivePayload = React.useMemo(() => applyFitStateToPayload(payload, effectiveFit), [payload, effectiveFit]);

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

  const compact = size === "compact";
  const hasSelector = Boolean(sizes && sizes.length > 0 && onSelectSize);
  const summaryVisible = showSummary ?? Boolean(fit);

  const selector = hasSelector ? (
    <div style={{ padding: compact ? "8px 8px 0" : "10px 10px 0" }}>
      <SizeSelector3D
        options={sizes ?? []}
        selectedSize={effectiveFit.size}
        recommendedSize={effectiveFit.recommendedSize}
        loadingSize={loadingSize}
        onSelect={(next) => onSelectSize?.(next)}
        compact={compact}
      />
    </div>
  ) : null;

  const summary = summaryVisible ? (
    <div
      data-testid="fit-preview-summary"
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "baseline",
        gap: 8,
        padding: compact ? "8px 8px 0" : "10px 10px 0",
        fontSize: compact ? 12 : 13,
        color: "#2a2a2e",
      }}
    >
      <span>
        Tamanho <strong>{effectiveFit.size}</strong>
      </span>
      {effectiveFit.fitScore != null ? (
        <span>
          · score <strong>{formatScore(effectiveFit.fitScore)}</strong>/10
        </span>
      ) : null}
      {effectiveFit.recommendedSize ? (
        <span style={{ color: effectiveFit.isRecommended ? "#5f7f6a" : "#6f6b66" }}>
          {effectiveFit.isRecommended ? "· tamanho recomendado" : `· recomendado: ${effectiveFit.recommendedSize}`}
        </span>
      ) : null}
      {loadingSize ? <span style={{ color: "#8a837a" }}>· atualizando…</span> : null}
    </div>
  ) : null;

  const legend = showLegend ? <FitLegend fit={effectiveFit} compact={compact} /> : null;

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
    // Sem Canvas: seletor, resumo e legenda continuam funcionando (dados do motor).
    return (
      <div className={className} data-testid="fit-preview-fallback">
        {selector}
        {summary}
        {fallbackNode}
        {legend}
      </div>
    );
  }

  return (
    <div className={className} data-testid="fit-preview-3d" data-manifest-status={manifestStatus} data-size={effectiveFit.size}>
      <div
        style={{
          overflow: "hidden",
          borderRadius: compact ? 16 : 24,
          border: "1px solid #ddd6cb",
          background: "#f7f4ef",
        }}
      >
        {selector}
        {summary}
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
        <div style={{ marginTop: 8 }}>
          <AvatarScene
            payload={effectivePayload}
            regions={effectiveFit.regionList}
            modelsBaseUrl={modelsBaseUrl}
            manifest={manifest}
            renderPlaceholders={renderPlaceholders}
            height={height}
            cameraCommand={cameraCommand}
            onContextLost={handleContextLost}
            onAssetError={onAssetError}
          />
        </div>
        {legend ? <div style={{ paddingBottom: compact ? 8 : 10 }}>{legend}</div> : null}
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
