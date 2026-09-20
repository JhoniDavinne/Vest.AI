"use client";

import * as React from "react";

interface ModelErrorBoundaryProps {
  /** Renderizado quando o carregamento/renderizacao do GLB falhar. */
  fallback: React.ReactNode;
  /** Ao mudar, a boundary volta ao estado saudavel (ex.: nova URL de asset). */
  resetKey?: string;
  onError?: (error: Error) => void;
  children: React.ReactNode;
}

interface ModelErrorBoundaryState {
  failed: boolean;
  key?: string;
}

/**
 * Isola falhas de assets 3D (404, GLB corrompido, extensao nao suportada).
 * `useGLTF` lanca dentro do Suspense; sem esta boundary o erro subiria ate a
 * pagina e derrubaria a tela de resultado — o que nunca pode acontecer.
 */
export class ModelErrorBoundary extends React.Component<ModelErrorBoundaryProps, ModelErrorBoundaryState> {
  state: ModelErrorBoundaryState = { failed: false, key: this.props.resetKey };

  static getDerivedStateFromError(): Partial<ModelErrorBoundaryState> {
    return { failed: true };
  }

  static getDerivedStateFromProps(
    props: ModelErrorBoundaryProps,
    state: ModelErrorBoundaryState,
  ): Partial<ModelErrorBoundaryState> | null {
    if (props.resetKey !== state.key) {
      return { failed: false, key: props.resetKey };
    }
    return null;
  }

  componentDidCatch(error: Error): void {
    this.props.onError?.(error);
    if (typeof console !== "undefined") {
      console.warn("[fit-preview-3d] asset 3D indisponivel, usando fallback:", error.message);
    }
  }

  render(): React.ReactNode {
    if (this.state.failed) return this.props.fallback;
    return this.props.children;
  }
}
