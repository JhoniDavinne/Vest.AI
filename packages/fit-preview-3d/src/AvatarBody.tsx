"use client";

import type { FitPreviewPayload } from "./types";
import { StylizedSilhouette } from "./StylizedSilhouette";

interface AvatarBodyProps {
  payload: FitPreviewPayload;
  modelsBaseUrl?: string;
}

/**
 * Silhueta estilizada em billboard — mesma textura do guia "Como medir".
 */
export function AvatarBody({ payload }: AvatarBodyProps) {
  return <StylizedSilhouette payload={payload} />;
}

export { STATUS_COLOR_HEX } from "./constants";
