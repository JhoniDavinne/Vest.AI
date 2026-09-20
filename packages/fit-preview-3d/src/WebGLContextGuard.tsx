"use client";

import * as React from "react";
import { useThree } from "@react-three/fiber";

interface WebGLContextGuardProps {
  onContextLost: () => void;
  /** Disparado quando o navegador restaura o contexto (three.js recompila recursos sozinho). */
  onContextRestored?: () => void;
}

/**
 * Detecta perda/restauracao de contexto WebGL e notifica o host.
 * `preventDefault` em `webglcontextlost` sinaliza ao navegador que queremos tentar restaurar;
 * o host decide (com um curto periodo de tolerancia) se cai para o fallback 2D.
 */
export function WebGLContextGuard({ onContextLost, onContextRestored }: WebGLContextGuardProps) {
  const { gl } = useThree();

  React.useEffect(() => {
    const canvas = gl.domElement;

    const onLost = (event: Event) => {
      event.preventDefault();
      onContextLost();
    };
    const onRestored = () => {
      onContextRestored?.();
    };

    canvas.addEventListener("webglcontextlost", onLost, false);
    canvas.addEventListener("webglcontextrestored", onRestored, false);
    return () => {
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
    };
  }, [gl, onContextLost, onContextRestored]);

  return null;
}
