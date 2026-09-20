"use client";

import * as React from "react";
import { loadModelsManifest, type ModelsManifest } from "./manifest";

export type ManifestStatus = "idle" | "loading" | "ready" | "unavailable";

export interface ModelsManifestState {
  manifest: ModelsManifest | null;
  status: ManifestStatus;
}

/**
 * Carrega o manifest de assets no cliente (nunca durante SSR).
 * Enquanto `status !== "ready"` a cena renderiza a representacao estilizada.
 */
export function useModelsManifest(baseUrl: string, enabled = true): ModelsManifestState {
  const [state, setState] = React.useState<ModelsManifestState>({ manifest: null, status: enabled ? "loading" : "idle" });

  React.useEffect(() => {
    if (!enabled) {
      setState({ manifest: null, status: "idle" });
      return;
    }
    let cancelled = false;
    setState((prev) => (prev.status === "loading" ? prev : { manifest: null, status: "loading" }));
    void loadModelsManifest(baseUrl).then((manifest) => {
      if (cancelled) return;
      setState({ manifest, status: manifest ? "ready" : "unavailable" });
    });
    return () => {
      cancelled = true;
    };
  }, [baseUrl, enabled]);

  return state;
}
