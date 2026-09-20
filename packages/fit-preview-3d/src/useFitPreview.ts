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
