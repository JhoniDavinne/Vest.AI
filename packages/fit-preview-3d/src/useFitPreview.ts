import * as React from "react";

export function useWebGLAvailable(): boolean {
  const [available, setAvailable] = React.useState(true);

  React.useEffect(() => {
    try {
      const canvas = document.createElement("canvas");
      const gl =
        canvas.getContext("webgl2") ??
        canvas.getContext("webgl") ??
        canvas.getContext("experimental-webgl");
      setAvailable(Boolean(gl));
    } catch {
      setAvailable(false);
    }
  }, []);

  return available;
}

export function useFitPreviewCanvasHeight(size: "full" | "medium" | "compact"): number {
  switch (size) {
    case "full":
      return 420;
    case "medium":
      return 360;
    case "compact":
      return 320;
    default: {
      const _exhaustive: never = size;
      return _exhaustive;
    }
  }
}

/** Altura maxima do canvas em viewports estreitas (evita Canvas alto demais no mobile). */
export const MOBILE_CANVAS_HEIGHT: Record<"full" | "medium" | "compact", number> = {
  full: 340,
  medium: 300,
  compact: 260,
};

const MOBILE_QUERY = "(max-width: 639px)";

/** Altura do canvas ajustada ao viewport (SSR-safe: comeca com a altura padrao). */
export function useResponsiveCanvasHeight(size: "full" | "medium" | "compact"): number {
  const base = useFitPreviewCanvasHeight(size);
  const [mobile, setMobile] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const media = window.matchMedia(MOBILE_QUERY);
    const update = () => setMobile(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return mobile ? Math.min(base, MOBILE_CANVAS_HEIGHT[size]) : base;
}

/** `true` quando o usuario prefere menos movimento (transicoes sao suprimidas). */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = React.useState(false);
  React.useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return reduced;
}
