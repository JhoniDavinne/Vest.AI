"use client";

import * as React from "react";
import { useThree } from "@react-three/fiber";

/** Detecta perda de contexto WebGL e notifica o host para exibir fallback 2D. */
export function WebGLContextGuard({ onContextLost }: { onContextLost: () => void }) {
  const { gl } = useThree();
  const notified = React.useRef(false);

  React.useEffect(() => {
    const canvas = gl.domElement;

    const notify = () => {
      if (notified.current) return;
      notified.current = true;
      onContextLost();
    };

    const onLost = (event: Event) => {
      event.preventDefault();
      notify();
    };

    canvas.addEventListener("webglcontextlost", onLost, false);
    return () => {
      canvas.removeEventListener("webglcontextlost", onLost);
    };
  }, [gl, onContextLost]);

  return null;
}
