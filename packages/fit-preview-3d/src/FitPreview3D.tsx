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
import { usePrefersReducedMotion, useResponsiveCanvasHeight, useWebGLAvailable } from "./useFitPreview";
import { useModelsManifest } from "./useModelsManifest";
import { ensureFitPreviewStyles } from "./styles";

function formatScore(value: number): string {
  return value.toFixed(1).replace(".", ",");
}

/** Tempo de tolerancia para o navegador restaurar um contexto WebGL perdido. */
const CONTEXT_RESTORE_GRACE_MS = 1500;

/**
 * Provador visual 3D.
 *
 *   RecommendationResponse → createFitVisualizationState*() → `fit`
 *   FitPreview3D
 *     ├── AvatarScene (Canvas)      avatar · peca · RegionalOverlay(fit.regionList)
 *     ├── FitPreviewControls (HTML) Frente · Lateral · Costas · + · − · Reset
 *     ├── SizeSelector3D   (HTML)   tamanhos do motor, recomendado × selecionado
 *     └── FitLegend (HTML)          "Peito — Compatível"
 *
 * Layout: canvas no topo, controles logo abaixo (nao cobrem o avatar no mobile),
 * seletor e legenda em seguida. Um unico Canvas, nunca desmontado na troca de tamanho.
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
  React.useEffect(() => {
    ensureFitPreviewStyles();
  }, []);

  const webgl = useWebGLAvailable();
  const height = useResponsiveCanvasHeight(size);
  const reducedMotion = usePrefersReducedMotion();
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

  // Perda de contexto WebGL: aguarda um curto periodo pela restauracao automatica
  // (three.js recompila recursos) antes de cair para o fallback 2D definitivo.
  const lostTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleContextLost = React.useCallback(() => {
    if (lostTimer.current) return;
    lostTimer.current = setTimeout(() => {
      lostTimer.current = null;
      setContextLost(true);
    }, CONTEXT_RESTORE_GRACE_MS);
  }, []);
  const handleContextRestored = React.useCallback(() => {
    if (lostTimer.current) {
      clearTimeout(lostTimer.current);
      lostTimer.current = null;
    }
  }, []);
  React.useEffect(
    () => () => {
      if (lostTimer.current) clearTimeout(lostTimer.current);
    },
    [],
  );

  const compact = size === "compact";
  const hasSelector = Boolean(sizes && sizes.length > 0 && onSelectSize);
  const summaryVisible = showSummary ?? Boolean(fit);
  const updating = loadingSize != null && loadingSize === effectiveFit.size;
  const rootClass = ["vfp-root", compact ? "vfp-compact" : "", className ?? ""].filter(Boolean).join(" ");
  const fadeClass = reducedMotion ? undefined : "vfp-fade";

  const selector = hasSelector ? (
    <div style={{ padding: compact ? "0 8px 8px" : "0 10px 10px" }}>
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
      key={`summary-${effectiveFit.size}`}
      data-testid="fit-preview-summary"
      className={["vfp-summary", fadeClass].filter(Boolean).join(" ")}
      style={{ padding: compact ? "8px 8px 0" : "10px 10px 0", fontSize: compact ? 12 : 13 }}
    >
      <span>
        Tamanho <strong>{effectiveFit.size}</strong>
      </span>
      {effectiveFit.fitScore != null ? (
        <span>
          · caimento <strong>{formatScore(effectiveFit.fitScore)}</strong>/10
        </span>
      ) : null}
      {effectiveFit.recommendedSize ? (
        <span className="vfp-muted" style={{ color: effectiveFit.isRecommended ? "#5f7f6a" : undefined }}>
          {effectiveFit.isRecommended ? "· recomendado" : `· recomendado: ${effectiveFit.recommendedSize}`}
        </span>
      ) : null}
    </div>
  ) : null;

  const legend = showLegend ? (
    <div key={`legend-${effectiveFit.size}`} className={fadeClass} style={{ padding: compact ? "0 8px 8px" : "0 10px 10px" }}>
      <FitLegend fit={effectiveFit} compact={compact} variant="inline" />
    </div>
  ) : null;

  const disclaimer = showDisclaimer ? <p className="vfp-disclaimer">{payload.disclaimer || FIT_PREVIEW_DISCLAIMER}</p> : null;

  const fallbackNode = fallback ?? (
    <div className="vfp-fallback" style={{ minHeight: Math.min(height, 240) }}>
      Prévia 3D indisponível neste dispositivo. Use a análise por região.
    </div>
  );

  if (!webgl || contextLost) {
    // Sem Canvas: seletor, resumo e legenda continuam funcionando (dados do motor).
    return (
      <div className={rootClass} data-testid="fit-preview-fallback">
        {summary}
        {fallbackNode}
        {selector}
        {legend}
        {disclaimer}
      </div>
    );
  }

  return (
    <div className={rootClass} data-testid="fit-preview-3d" data-manifest-status={manifestStatus} data-size={effectiveFit.size}>
      <div className={compact ? "vfp-frame vfp-compact" : "vfp-frame"}>
        {summary}
        <div className="vfp-stage" aria-busy={updating || undefined}>
          {updating ? (
            <div className="vfp-updating" role="status" aria-live="polite">
              <span className="vfp-spinner" aria-hidden="true" />
              Atualizando tamanho…
            </div>
          ) : null}
          <AvatarScene
            payload={effectivePayload}
            regions={effectiveFit.regionList}
            modelsBaseUrl={modelsBaseUrl}
            manifest={manifest}
            renderPlaceholders={renderPlaceholders}
            height={height}
            cameraCommand={cameraCommand}
            onContextLost={handleContextLost}
            onContextRestored={handleContextRestored}
            onAssetError={onAssetError}
          />
        </div>
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
        {selector}
        {legend}
      </div>
      {disclaimer}
      <p className="vfp-hint" aria-hidden="true">
        Arraste para rotacionar · scroll ou pinça para zoom
      </p>
    </div>
  );
}
